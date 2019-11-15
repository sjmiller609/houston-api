import { DuplicateDeploymentLabelError, TrialError } from "errors";
import resolvers from "resolvers";
import * as validate from "deployments/validate";
import casual from "casual";
import config from "config";
import { graphql } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { importSchema } from "graphql-import";
import {
  AIRFLOW_EXECUTOR_DEFAULT,
  DEPLOYMENT_AIRFLOW,
  DEPLOYMENT_PROPERTY_COMPONENT_VERSION,
  DEPLOYMENT_PROPERTY_EXTRA_AU
} from "constants";

// Import our application schema
const schema = makeExecutableSchema({
  typeDefs: importSchema("src/schema.graphql"),
  resolvers
});

// Define our mutation
const mutation = `
  mutation createDeployment(
    $workspaceUuid: Uuid!
    $type: String!
    $label: String!
    $description: String
    $version: String
    $config: JSON
    $env: JSON
    $properties: JSON
  ) {
    createDeployment(
      workspaceUuid: $workspaceUuid
      type: $type
      label: $label
      description: $description
      version: $version
      config: $config
      env: $env
      properties: $properties
    ) {
        id
        config
        env
        urls {
          type
          url
        }
        properties
        description
        label
        releaseName
        status
        type
        version
        workspace {
          id
        }
        createdAt
        updatedAt
      }
    }
`;

describe("createDeployment", () => {
  describe("typical request", () => {
    let user,
      deploymentId,
      createDeployment,
      createRoleBinding,
      workspace,
      commander,
      vars,
      db;
    const currentNamespace = casual.word;
    beforeAll(() => {
      config.helm.releaseNamespace = currentNamespace;
    });

    beforeEach(() => {
      user = {
        id: casual.uuid
      };

      deploymentId = casual.uuid;

      // Mock up some db functions.
      createDeployment = jest.fn(req => {
        return {
          id: deploymentId,
          // Use the releaseName from the request
          releaseName: req.data.releaseName,
          config: { executor: AIRFLOW_EXECUTOR_DEFAULT },
          createdAt: new Date(),
          updatedAt: new Date()
        };
      });

      createRoleBinding = jest.fn().mockReturnValue({
        id: casual.uuid
      });

      workspace = jest.fn().mockReturnValue({ stripeCustomerId: casual.uuid });

      // Construct db object for context.
      db = {
        mutation: { createDeployment, createRoleBinding },
        query: { workspace }
      };

      // Create mock commander client.
      commander = {
        request: jest.fn()
      };

      // Vars for the gql mutation.
      vars = {
        workspaceUuid: casual.uuid,
        type: DEPLOYMENT_AIRFLOW,
        label: casual.word,
        properties: {
          [DEPLOYMENT_PROPERTY_EXTRA_AU]: casual.integer(0, 300),
          [DEPLOYMENT_PROPERTY_COMPONENT_VERSION]: "7.0"
        }
      };
    });

    test("is successful", async () => {
      // Create some deployment vars.
      // Override and not throw any error.
      jest.spyOn(validate, "default").mockReturnValue();

      // Run the graphql mutation.
      const res = await graphql(
        schema,
        mutation,
        null,
        { db, commander, user },
        vars
      );

      expect(res.errors).toBeUndefined();
      expect(createDeployment.mock.calls.length).toBe(1);
      expect(commander.request.mock.calls[0][0]).toBe("createDeployment");
      expect(commander.request.mock.calls[0][1].namespace).toEqual(
        expect.stringMatching("^" + currentNamespace + "-")
      );
      expect(res.data.createDeployment.id).toBe(deploymentId);
    });

    describe("in singleNamespace node", () => {
      beforeEach(() => {
        config.helm.singleNamespace = true;
      });
      afterEach(() => {
        config.helm.singleNamespace = false;
      });
      test("is successful", async () => {
        // Create some deployment vars.
        // Override and not throw any error.
        jest.spyOn(validate, "default").mockReturnValue();

        // Run the graphql mutation.
        const res = await graphql(
          schema,
          mutation,
          null,
          { db, commander, user },
          vars
        );

        expect(res.errors).toBeUndefined();
        expect(createDeployment.mock.calls.length).toBe(1);
        expect(commander.request.mock.calls[0][0]).toBe("createDeployment");
        expect(commander.request.mock.calls[0][1].namespace).toBe(
          currentNamespace
        );
        expect(res.data.createDeployment.id).toBe(deploymentId);
      });
    });
  });

  test("request fails if deployment with same label exists", async () => {
    const createDeployment = jest.fn();
    const workspace = jest
      .fn()
      .mockReturnValue({ stripeCustomerId: casual.uuid });

    // Set up our spy.
    jest
      .spyOn(validate, "default")
      .mockImplementation(() => throw new DuplicateDeploymentLabelError());

    // Construct db object for context.
    const db = {
      mutation: { createDeployment },
      query: { workspace }
    };

    // Vars for the gql mutation.
    const vars = {
      workspaceUuid: casual.uuid,
      type: DEPLOYMENT_AIRFLOW,
      label: casual.word
    };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db }, vars);

    expect(res.errors.length).toBe(1);
    expect(res.errors[0].message).toEqual(
      expect.stringMatching(/^Workspace already has a deployment named/)
    );
    expect(createDeployment).toHaveBeenCalledTimes(0);
  });
  test("request fails if payment info has not been submitted", async () => {
    const createDeployment = jest.fn();
    const workspace = jest.fn().mockReturnValue({ stripeCustomerId: null });

    // Set up our spy.
    jest
      .spyOn(validate, "default")
      .mockImplementation(() => throw new TrialError());

    // Construct db object for context.
    const db = {
      mutation: { createDeployment },
      query: { workspace }
    };

    // Vars for the gql mutation.
    const vars = {
      workspaceUuid: casual.uuid,
      type: DEPLOYMENT_AIRFLOW,
      label: casual.word
    };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db }, vars);

    expect(res.errors.length).toBe(1);
    expect(res.errors[0].message).toEqual(
      expect.stringMatching(/^Workspace is in trial mode/)
    );
    expect(createDeployment).toHaveBeenCalledTimes(0);
  });
});
