import resolvers from "resolvers";
import casual from "casual";
import { graphql } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { importSchema } from "graphql-import";
import { ENTITY_WORKSPACE, WORKSPACE_ADMIN } from "constants";

// Import our application schema
const schema = makeExecutableSchema({
  typeDefs: importSchema("src/schema.graphql"),
  resolvers
});

// Define our mutation
const mutation = `
  mutation createServiceAccount(
    $label: String!,
    $category: String,
    $entityType: EntityType!,
    $entityUuid: Uuid,
    $role: Role!
  ) {
    createServiceAccount(
      label: $label,
      category: $category,
      entityType: $entityType,
      entityUuid: $entityUuid,
      role: $role
    ) {
      id
      label
      apiKey
      entityType
      entityUuid
      category
      active
      lastUsedAt
      createdAt
      updatedAt
    }
  }
`;

describe("createServiceAccount", () => {
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
      entityType: ENTITY_WORKSPACE,
      entityUuid: workspaceId,
      role: WORKSPACE_ADMIN
    };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db, user }, vars);

    expect(res.errors).toBeUndefined();
    expect(createServiceAccount.mock.calls).toHaveLength(1);
  });

  test("error is thrown if passing entityUuid and does not have access", async () => {
    // Create mock user.
    const user = {
      id: casual.uuid,
      username: casual.email,
      roleBindings: [
        {
          role: WORKSPACE_ADMIN,
          workspace: { id: casual.uuid }
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
      entityType: ENTITY_WORKSPACE,
      entityUuid: casual.uuid,
      role: WORKSPACE_ADMIN
    };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db, user }, vars);

    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].message).toEqual(
      expect.stringMatching(/^You do not have the appropriate permissions/)
    );
    expect(createServiceAccount.mock.calls).toHaveLength(0);
  });
});
