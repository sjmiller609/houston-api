import router from "./index";
import * as handler from "./handler";
import * as rbac from "rbac";
import { authenticateRequest } from "authentication";
import { decodeJWT } from "jwt";
import { prisma } from "generated/client";
import { getCookieName } from "utilities";
import cookieParser from "cookie-parser";
import casual from "casual";
import supertest from "supertest";
import express from "express";
import {
  DEPLOYMENT_ADMIN,
  DEPLOYMENT_EDITOR,
  DEPLOYMENT_VIEWER,
  SYSTEM_ADMIN,
  SYSTEM_EDITOR,
  SYSTEM_VIEWER
} from "constants";

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
const app = express()
  .use(cookieParser(), authenticateRequest())
  .use(router);
const request = supertest
  .agent(app)
  .set("x-original-url", "http://imploding-sun-1234-airflow.example.com/");

describe("GET /authorization", () => {
  test("fails if no user token", async () => {
    await expect(request.get("/")).resolves.toHaveProperty("statusCode", 401);
  });

  test("fails if invalid cookie", async () => {
    const res = request.get("/").set("Cookie", `${getCookieName()}=invalid`);
    await expect(res).resolves.toHaveProperty("statusCode", 401);
  });

  describe("With a valid user", () => {
    const id = casual.uuid;
    const deploymentId = casual.uuid;

    const userObject = {
      id,
      username: casual.email,
      fullName: casual.name,
      roleBindings: [
        { role: DEPLOYMENT_ADMIN, deployment: { id: deploymentId } }
      ]
    };

    beforeAll(() => {
      request.set("Cookie", `${getCookieName()}=MOCKED`);
      prisma.deployment = jest
        .fn()
        .mockName("deployment")
        .mockReturnValue({
          id: jest
            .fn()
            .mockName("id")
            .mockResolvedValue(deploymentId)
        });
    });

    beforeEach(() => {
      rbac.hasPermission.mockClear();
      rbac.getAuthUser.mockReturnValueOnce(userObject);
    });

    test("fails for a non-airflow URL", async () => {
      await expect(
        request.get("/").set("x-original-url", "http://other.example.com")
      ).resolves.toHaveProperty("statusCode", 401);
    });

    test("Deployment admin user has access", async () => {
      rbac.hasPermission.mockReturnValue(true);
      const res = request.get("/");

      await expect(res).resolves.toHaveProperty("statusCode", 200);
      expect(prisma.deployment).toBeCalledWith({
        deletedAt: null,
        releaseName: "imploding-sun-1234"
      });
    });

    test("Denied when not a member of the workspace", async () => {
      rbac.hasPermission.mockReturnValue(false);

      const res = request.get("/");
      await expect(res).resolves.toHaveProperty("statusCode", 403);
      expect(prisma.deployment).toBeCalledWith({
        deletedAt: null,
        releaseName: "imploding-sun-1234"
      });
    });
  });

  describe("With a valid service account", () => {
    const id = casual.uuid;
    const deploymentId = casual.uuid;

    // The key difference here is no email/name
    const saObject = {
      id,
      label: casual.name,
      roleBindings: [
        { role: DEPLOYMENT_ADMIN, deployment: { id: deploymentId } }
      ]
    };

    beforeAll(() => {
      request.set("Cookie", `${getCookieName()}=MOCKED`);
      prisma.deployment = jest
        .fn()
        .mockName("deployment")
        .mockReturnValue({
          id: jest
            .fn()
            .mockName("id")
            .mockResolvedValue(deploymentId)
        });
    });

    beforeEach(() => {
      rbac.hasPermission.mockClear();
      rbac.getAuthUser.mockReturnValueOnce(saObject);
    });

    test("fails for a non-airflow URL", async () => {
      await expect(
        request.get("/").set("x-original-url", "http://other.example.com")
      ).resolves.toHaveProperty("statusCode", 401);
    });

    test("Deployment admin user has access", async () => {
      rbac.hasPermission.mockReturnValue(true);
      const res = request.get("/");

      await expect(res).resolves.toHaveProperty("statusCode", 200);
      expect(prisma.deployment).toBeCalledWith({
        deletedAt: null,
        releaseName: "imploding-sun-1234"
      });
    });

    test("Denied when not a member of the workspace", async () => {
      rbac.hasPermission.mockReturnValue(false);

      const res = request.get("/");
      await expect(res).resolves.toHaveProperty("statusCode", 403);
      expect(prisma.deployment).toBeCalledWith({
        deletedAt: null,
        releaseName: "imploding-sun-1234"
      });
    });
  });
});

describe("airflowJWT", () => {
  describe("for User objects", () => {
    const user = {
      id: casual.uuid,
      fullName: casual.name,
      username: casual.email.toLowerCase()
    };
    test("contains the expected claims", async () => {
      const host = casual.domain;

      const token = handler.airflowJWT(user, ["Op"], host);

      const claims = await decodeJWT(token);

      expect(claims).toHaveProperty("aud", host);
      expect(claims).toHaveProperty("exp", expect.any(Number));
      expect(claims).toHaveProperty("nbf", expect.any(Number));
      expect(claims).toHaveProperty("roles", ["Op"]);
      expect(claims).toHaveProperty("sub", user.id);
      expect(claims).toHaveProperty("full_name", user.fullName);
      expect(claims).toHaveProperty("email", user.username);
    });
  });
  describe("for ServiceAccount objects", () => {
    const sa = {
      id: casual.uuid,
      label: casual.name
    };
    test("contains the expected claims", async () => {
      const host = casual.domain;

      const token = handler.airflowJWT(sa, ["Op"], host);

      const claims = await decodeJWT(token);

      expect(claims).toHaveProperty("aud", host);
      expect(claims).toHaveProperty("exp", expect.any(Number));
      expect(claims).toHaveProperty("nbf", expect.any(Number));
      expect(claims).toHaveProperty("roles", ["Op"]);
      expect(claims).toHaveProperty("sub", sa.id);
      expect(claims).toHaveProperty(
        "full_name",
        `Service Account: ${sa.label}`
      );
      expect(claims).toHaveProperty(
        "email",
        `${sa.id}@service-accounts.astronomer.io`
      );
    });
  });
});

describe("mapLocalRolesToAirflow", () => {
  const deploymentId = casual.uuid;
  const userObject = {
    id: casual.uuid,
    username: casual.email,
    roleBindings: null
  };

  afterAll(rbac.hasPermission.mockClear);

  beforeAll(() => {
    rbac.hasPermission.mockImplementation(
      jest.requireActual("../../../lib/rbac").hasPermission
    );
  });

  test.each`
    role                 | expected
    ${DEPLOYMENT_ADMIN}  | ${["Admin"]}
    ${DEPLOYMENT_EDITOR} | ${["User"]}
    ${DEPLOYMENT_VIEWER} | ${["Viewer"]}
  `("$role gives $expected", ({ role, expected }) => {
    userObject.roleBindings = [{ role, deployment: { id: deploymentId } }];
    const roles = handler.mapLocalRolesToAirflow(userObject, deploymentId);
    expect(roles).toEqual(expected);
  });
  test.each`
    role             | expected
    ${SYSTEM_ADMIN}  | ${["Admin"]}
    ${SYSTEM_EDITOR} | ${["User"]}
    ${SYSTEM_VIEWER} | ${["Viewer"]}
  `("$role gives $expected", ({ role, expected }) => {
    userObject.roleBindings = [{ role }];
    const roles = handler.mapLocalRolesToAirflow(userObject, deploymentId);
    expect(roles).toEqual(expected);
  });
});
