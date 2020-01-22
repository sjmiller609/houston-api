import router from "./index";
import { prisma } from "generated/client";
import { createJWT, decodeJWT } from "jwt";
import * as rbac from "rbac";
import bcrypt from "bcryptjs";
import casual from "casual";
import supertest from "supertest";
import express from "express";
import { DEPLOYMENT_ADMIN } from "constants";

jest.mock("rbac");
jest.mock("generated/client", () => {
  return {
    __esModule: true,
    prisma: jest.fn().mockName("MockPrisma")
  };
});
jest.mock("errors/express", () => {
  // Replace the error catcher with one that just throws, so that errors in tests are reported!
  return { catchAsyncError: fn => fn };
});

// Create test application.
const app = express().use(router);
const request = supertest(app);

describe("POST /registry", () => {
  test("fails if no no Authorization header", async () => {
    const res = await request.get("/");

    expect(res.statusCode).toBe(403);
    expect(res.body).not.toHaveProperty("token");
  });

  test.each([["not-basic"], ["Bearer jwt.x"]])(
    "fails with %o Authorization header",
    async value => {
      const res = await request.get("/").set("Authorization", value);

      expect(res.statusCode).toBe(401);
      expect(res.body).not.toHaveProperty("token");
    }
  );

  test("Made up Basic auth fails", async () => {
    const res = await request.get("/").auth("-", "letmein");

    expect(res.statusCode).toBe(401);
    expect(res.body).not.toHaveProperty("token");
  });

  describe("with valid user JWT", () => {
    const id = casual.uuid;
    const deploymentId = casual.id;
    const jwtToken = createJWT({ uuid: id });
    const userObject = {
      id,
      roleBindings: [
        { role: DEPLOYMENT_ADMIN, deployment: { id: deploymentId } }
      ]
    };

    beforeEach(() => {
      rbac.hasPermission.mockClear();
    });
    beforeAll(() => {
      rbac.hasPermission.mockReturnValue(false);
      rbac.getAuthUser.mockReturnValue(userObject);
      rbac.accesibleDeploymentsWithPermission.mockReturnValue([]);

      prisma.deployment = jest
        .fn()
        .mockReturnValue({ id: jest.fn().mockResolvedValue(deploymentId) });
    });

    test("works without scope param", async () => {
      // Not passing a scope param simulates `docker login`
      const res = await request.get("/").auth("-", jwtToken);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("token");

      const jwt = await decodeJWT(res.body.token);
      expect(jwt.access).toEqual([
        // We always include the base images for any authenticated user
        { actions: ["pull"], name: "base-images/airflow", type: "repository" }
      ]);
    });

    test("permission denied for non-deployment image", async () => {
      const res = await request
        .get("/")
        .query({ scope: "made-up" })
        .auth("-", jwtToken);

      expect(res.statusCode).toBe(401);
      expect(res.body).not.toHaveProperty("token");
      expect(res.body.errors).toHaveLength(1);
      expect(res.body).toHaveProperty(["errors", 0, "code"], "NAME_UNKNOWN");
    });

    test("invalid scope returns 401", async () => {
      const res = await request
        .get("/")
        .query({ scope: "repository:not-a-deployment/foo/bar:push,pull" })
        .auth("-", jwtToken);

      expect(res.statusCode).toBe(401);
      expect(res.body).not.toHaveProperty("token");
      expect(res.body.errors).toHaveLength(1);
      expect(res.body).toHaveProperty(["errors", 0, "code"], "NAME_UNKNOWN");
    });

    test.each([["imploding-sun-1234/airflow"], ["base-images/airflow"]])(
      "permission denied without right permissions to %s",
      async image => {
        const res = await request
          .get("/")
          .query({ scope: `repository:${image}:push,pull` })
          .auth("-", jwtToken);

        expect(res.statusCode).toBe(401);
        expect(res.body).not.toHaveProperty("token");
      }
    );

    test.each`
      scope          | expectedPermission          | expected
      ${"push,pull"} | ${"deployment.images.push"} | ${["push", "pull"]}
      ${"pull"}      | ${"deployment.images.pull"} | ${["pull"]}
    `(
      "returns JWT payload with correct permissions for $scope",
      async ({ scope, expectedPermission, expected }) => {
        rbac.hasPermission.mockReturnValueOnce(true);

        const res = await request
          .get("/")
          .query({ scope: `repository:imploding-sun-1234/airflow:${scope}` })
          .auth("-", jwtToken);

        expect(res.body).not.toHaveProperty("errors"); // Aid
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("token");

        const decodedJWT = await decodeJWT(res.body.token);
        expect(decodedJWT.access).toEqual([
          {
            actions: expected,
            name: "imploding-sun-1234/airflow",
            type: "repository"
          },
          { actions: ["pull"], name: "base-images/airflow", type: "repository" }
        ]);
        expect(rbac.hasPermission).toBeCalledWith(
          userObject,
          expectedPermission,
          "deployment",
          deploymentId
        );
      }
    );

    test("Other deployments are included in access", async () => {
      rbac.hasPermission.mockReturnValueOnce(true);
      const otherId = casual.uuid;
      rbac.accesibleDeploymentsWithPermission.mockReturnValueOnce([
        deploymentId,
        otherId
      ]);

      prisma.deployments = jest
        .fn()
        .mockName("deployments")
        .mockReturnValueOnce({
          releaseName: jest
            .fn()
            .mockResolvedValue([
              { releaseName: "imploding-sun-1234" },
              { releaseName: "gravitational-nova-5678" }
            ])
        });

      const res = await request
        .get("/")
        .query({ scope: `repository:imploding-sun-1234/airflow:pull,push` })
        .auth("-", jwtToken);

      expect(res.body).not.toHaveProperty("errors"); // Aid
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("token");

      const decodedJWT = await decodeJWT(res.body.token);
      expect(decodedJWT.access).toEqual([
        {
          actions: ["pull", "push"],
          name: "imploding-sun-1234/airflow",
          type: "repository"
        },
        { actions: ["pull"], name: "base-images/airflow", type: "repository" },
        {
          actions: ["pull"],
          name: "gravitational-nova-5678/airflow",
          type: "repository"
        }
      ]);
      expect(rbac.hasPermission).toBeCalledWith(
        userObject,
        "deployment.images.push",
        "deployment",
        deploymentId
      );
      expect(rbac.accesibleDeploymentsWithPermission).toBeCalledWith(
        userObject,
        "deployment.images.pull"
      );
      expect(prisma.deployments).toBeCalledWith({
        where: { id_in: [deploymentId, otherId] }
      });
    });

    test("Multiple scopes can be included at once", async () => {
      rbac.hasPermission.mockReturnValueOnce(true).mockReturnValueOnce(true);

      const res = await request
        .get("/")
        .query({
          scope: [
            "repository:imploding-sun-1234/airflow:pull,push",
            "repository:gravitational-nova-5678/airflow:pull,push"
          ]
        })
        .auth("-", jwtToken);

      expect(res.body).not.toHaveProperty("errors"); // Aid
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("token");

      const decodedJWT = await decodeJWT(res.body.token);
      expect(decodedJWT.access).toEqual([
        {
          actions: ["pull", "push"],
          name: "imploding-sun-1234/airflow",
          type: "repository"
        },
        {
          actions: ["pull", "push"],
          name: "gravitational-nova-5678/airflow",
          type: "repository"
        },
        { actions: ["pull"], name: "base-images/airflow", type: "repository" }
      ]);
      expect(rbac.hasPermission).toBeCalledWith(
        userObject,
        "deployment.images.push",
        "deployment",
        deploymentId
      );
      expect(rbac.accesibleDeploymentsWithPermission).toBeCalledWith(
        userObject,
        "deployment.images.pull"
      );
    });

    test("System Admins can push to base-images", async () => {
      rbac.hasPermission.mockReturnValueOnce(true);

      const res = await request
        .get("/")
        .query({ scope: `repository:base-images/airflow:push,pull` })
        .auth("-", jwtToken);

      expect(res.body).not.toHaveProperty("errors"); // Aid
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("token");

      const decodedJWT = await decodeJWT(res.body.token);
      expect(decodedJWT.access).toEqual([
        {
          actions: ["push", "pull"],
          name: "base-images/airflow",
          type: "repository"
        }
      ]);
      expect(rbac.hasPermission).toBeCalledWith(
        userObject,
        "system.registryBaseImages.push"
      );
    });

    test("any user can pull from base images", async () => {
      const res = await request
        .get("/")
        .query({ scope: `repository:base-images/airflow:pull` })
        .auth("-", jwtToken);

      expect(res.body).not.toHaveProperty("errors"); // Aid
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("token");

      const decodedJWT = await decodeJWT(res.body.token);
      expect(decodedJWT.access).toEqual([
        {
          actions: ["pull"],
          name: "base-images/airflow",
          type: "repository"
        }
      ]);
      expect(rbac.hasPermission).not.toBeCalled();
    });
  });

  test("auth via `registryPassword` field works", async () => {
    // This path is used for ImagePullSecret from deployments

    const password = casual.password;
    const hash = await bcrypt.hash(password, 10);

    rbac.getAuthUser.mockReturnValueOnce(undefined);
    prisma.deployment = jest
      .fn()
      .mockReturnValue({ registryPassword: jest.fn().mockResolvedValue(hash) });

    const res = await request
      .get("/")
      .query({ scope: "repository:imploding-sun-1234/airflow:pull" })
      .auth("imploding-sun-1234", password);

    expect(res.body).not.toHaveProperty("errors"); // Aid
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");

    const decodedJWT = await decodeJWT(res.body.token);
    expect(decodedJWT.access).toEqual([
      {
        actions: ["pull"],
        name: "imploding-sun-1234/airflow",
        type: "repository"
      },
      { actions: ["pull"], name: "base-images/airflow", type: "repository" }
    ]);
    expect(rbac.hasPermission).not.toBeCalled();
  });

  describe("in production environment", () => {
    const OLD_ENV = process.env;

    beforeAll(() => {
      process.env = { ...OLD_ENV };
      process.env.NODE_ENV = "production";
    });

    afterEach(() => {
      process.env = OLD_ENV;
    });

    test("x-original-uri is required", async () => {
      let res = await request
        .get("/")
        .query({ scope: "base-images/airflow:pull" });

      expect(res.statusCode).toBe(401);
      expect(res.body).not.toHaveProperty("token");
      expect(res.body.errors).toHaveLength(1);
      expect(res.body).toHaveProperty(["errors", 0, "code"], "NAME_UNKNOWN");
      expect(res.body).toHaveProperty(
        ["errors", 0, "message"],
        "Unknown registry service request"
      );

      // Test we get a different error with this check
      res = await request
        .get("/")
        .set("X-Original-Uri", "http://houston.local")
        .query({ scope: "base-images/airflow:pull" });

      expect(res.statusCode).toBe(403);
    });
  });
});
