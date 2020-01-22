import resolvers from "resolvers";
import casual from "casual";
import { graphql } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { importSchema } from "graphql-import";
import { WORKSPACE_ADMIN } from "constants";

// Import our application schema
const schema = makeExecutableSchema({
  typeDefs: importSchema("src/schema.graphql"),
  resolvers
});

// Define our mutation
const mutation = `
  mutation createWorkspaceServiceAccount(
    $label: String!,
    $category: String,
    $workspaceUuid: Uuid!,
    $role: Role!
  ) {
    createWorkspaceServiceAccount(
      label: $label,
      category: $category,
      workspaceUuid: $workspaceUuid,
      role: $role
    ) {
      id
      label
      apiKey
      entityType
      workspaceUuid
      category
      active
      lastUsedAt
      createdAt
      updatedAt
    }
  }
`;

describe("createWorkspaceServiceAccount", () => {
  test("typical request is successful", async () => {
    const workspaceId = casual.uuid;

    // Create mock user.
    const user = {
      id: casual.uuid,
      username: casual.email,
      roleBindings: [
        {
          role: WORKSPACE_ADMIN,
          workspace: { id: workspaceId }
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
      workspaceUuid: workspaceId,
      role: WORKSPACE_ADMIN
    };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db, user }, vars);

    expect(res.errors).toBeUndefined();
    expect(createServiceAccount.mock.calls).toHaveLength(1);
  });
});
