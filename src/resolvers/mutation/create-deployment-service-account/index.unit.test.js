import resolvers from "resolvers";
import casual from "casual";
import { graphql } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { importSchema } from "graphql-import";
import { DEPLOYMENT_ADMIN } from "constants";

// Import our application schema
const schema = makeExecutableSchema({
  typeDefs: importSchema("src/schema.graphql"),
  resolvers
});

// Define our mutation
const mutation = `
  mutation createDeploymentServiceAccount(
    $label: String!,
    $category: String,
    $deploymentUuid: Uuid!,
    $role: Role!
  ) {
    createDeploymentServiceAccount(
      label: $label,
      category: $category,
      deploymentUuid: $deploymentUuid,
      role: $role
    ) {
      id
      label
      apiKey
      entityType
      deploymentUuid
      category
      active
      lastUsedAt
      createdAt
      updatedAt
    }
  }
`;

describe("createDeploymentServiceAccount", () => {
  test("typical request is successful", async () => {
    const deploymentId = casual.uuid;

    // Create mock user.
    const user = {
      id: casual.uuid,
      username: casual.email,
      roleBindings: [
        {
          role: DEPLOYMENT_ADMIN,
          deployment: { id: deploymentId }
        }
      ]
    };

    // Create mock function.
    const createServiceAccount = jest.fn();

    // Construct db object for context.
    const db = {
      mutation: { createServiceAccount }
    };

    // Create variables.
    const vars = {
      label: casual.word,
      category: casual.word,
      deploymentUuid: deploymentId,
      role: DEPLOYMENT_ADMIN
    };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db, user }, vars);

    expect(res.errors).toBeUndefined();
    expect(createServiceAccount.mock.calls).toHaveLength(1);
  });
});
