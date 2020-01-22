import resolvers from "resolvers";
import { generateReleaseName } from "deployments/naming";
import casual from "casual";
import { graphql } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { importSchema } from "graphql-import";
import { AIRFLOW_EXECUTOR_DEFAULT } from "constants";

// Import our application schema
const schema = makeExecutableSchema({
  typeDefs: importSchema("src/schema.graphql"),
  resolvers
});

// Define our mutation
const mutation = `
  mutation upgradeDeployment(
    $deploymentUuid: Uuid!
    $version: String!
  ) {
    upgradeDeployment(
      deploymentUuid: $deploymentUuid
      version: $version
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

describe("upgradeDeployment", () => {
  test("typical request is successful", async () => {
    const id = casual.uuid;

    // Mock up some db functions.
    const updateDeployment = jest.fn().mockReturnValue({
      id,
      releaseName: generateReleaseName(),
      config: { executor: AIRFLOW_EXECUTOR_DEFAULT },
      createdAt: new Date(),
      updatedAt: new Date(),
      workspace: {
        id: casual.uuid
      }
    });

    // Construct db object for context.
    const db = {
      mutation: { updateDeployment }
    };

    // Create mock commander client.
    const commander = {
      request: jest.fn()
    };

    // Vars for the gql mutation.
    const vars = {
      deploymentUuid: id,
      version: "10.0.1"
    };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db, commander }, vars);

    expect(res.errors).toBeUndefined();
    expect(updateDeployment.mock.calls.length).toBe(1);
    expect(res.data.upgradeDeployment.id).toBe(id);
  });
});
