import resolvers from "resolvers";
import * as validate from "deployments/validate";
import { generateReleaseName } from "deployments/naming";
import casual from "casual";
import { graphql } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { importSchema } from "graphql-import";
import {
  AIRFLOW_EXECUTOR_DEFAULT,
  DEPLOYMENT_PROPERTY_COMPONENT_VERSION,
  DEPLOYMENT_PROPERTY_ALERT_EMAILS,
  DEPLOYMENT_PROPERTY_EXTRA_AU
} from "constants";

// Import our application schema
const schema = makeExecutableSchema({
  typeDefs: importSchema("src/schema.graphql"),
  resolvers
});

// Define our mutation
const mutation = `
  mutation updateDeployment(
    $deploymentUuid: Uuid!
    $payload: JSON
    $config: JSON
    $env: JSON
    $sync: Boolean
  ) {
    updateDeployment(
      deploymentUuid: $deploymentUuid
      payload: $payload
      config: $config
      env: $env
      sync: $sync
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

describe("updateDeployment", () => {
  test("typical request is successful", async () => {
    // Create some deployment vars.
    const id = casual.uuid;
    const releaseName = generateReleaseName();
    const label = casual.word;

    const deployment = jest.fn().mockReturnValue({
      releaseName,
      workspace: {
        id: casual.uuid,
        stripeCustomerId: casual.uuid,
        isSuspended: false
      },
      properties: [
        {
          id: casual.uuid,
          key: DEPLOYMENT_PROPERTY_EXTRA_AU,
          value: casual.integer(0, 500)
        },
        {
          id: casual.uuid,
          key: DEPLOYMENT_PROPERTY_COMPONENT_VERSION,
          value: "10.0.1"
        }
      ]
    });

    // Mock up some db functions.
    const updateDeployment = jest.fn().mockReturnValue({
      id,
      releaseName,
      config: { executor: AIRFLOW_EXECUTOR_DEFAULT },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const db = {
      query: { deployment },
      mutation: { updateDeployment }
    };

    // Create mock commander client.
    const commander = {
      request: jest.fn()
    };
    const user = {};

    // Set up our spy.
    jest.spyOn(validate, "default").mockReturnValue();

    // Vars for the gql mutation.
    const newExtraAu = casual.integer(0, 500);
    const newAlertEmail = casual.email;
    const vars = {
      deploymentUuid: id,
      label,
      properties: {
        [DEPLOYMENT_PROPERTY_EXTRA_AU]: newExtraAu,
        [DEPLOYMENT_PROPERTY_ALERT_EMAILS]: newAlertEmail
      }
    };

    // Run the graphql mutation.
    const res = await graphql(
      schema,
      mutation,
      null,
      { db, commander, user },
      vars
    );

    expect(res.errors).toBeUndefined();
    expect(deployment.mock.calls.length).toBe(1);
    expect(updateDeployment.mock.calls.length).toBe(1);
    expect(res.data.updateDeployment.id).toBe(id);
  });
});
