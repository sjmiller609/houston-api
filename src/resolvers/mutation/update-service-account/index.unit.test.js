import resolvers from "resolvers";
import casual from "casual";
import { graphql } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { importSchema } from "graphql-import";
import { ENTITY_WORKSPACE, WORKSPACE_ADMIN, WORKSPACE_VIEWER } from "constants";

// Import our application schema
const schema = makeExecutableSchema({
  typeDefs: importSchema("src/schema.graphql"),
  resolvers
});

// Define our mutation
const mutation = `
  mutation updateServiceAccount(
    $serviceAccountUuid: Uuid!
    $payload: JSON!
  ) {
    updateServiceAccount(
      serviceAccountUuid: $serviceAccountUuid
      payload: $payload
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

describe("updateServiceAccount", () => {
  test("typical request is successful", async () => {
    const workspaceId = casual.uuid;
    const serviceAccountId = casual.uuid;
    const label = casual.title;

    // Mock up a user.
    const user = {
      id: casual.uuid,
      roleBindings: [
        {
          role: WORKSPACE_ADMIN,
          workspace: { id: workspaceId }
        }
      ]
    };

    // Mock up some functions.
    const updateServiceAccount = jest.fn();

    // Construct db object for context.
    const db = {
      mutation: { updateServiceAccount }
    };

    // Vars for the gql mutation.
    const vars = {
      serviceAccountUuid: serviceAccountId,
      payload: {
        label,
        entityType: ENTITY_WORKSPACE,
        entityId: workspaceId
      }
    };

    const where = { id: serviceAccountId };
    const data = { label };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db, user }, vars);
    expect(res.errors).toBeUndefined();
    expect(updateServiceAccount).toHaveBeenCalledTimes(1);
    expect(updateServiceAccount).toHaveBeenCalledWith(
      { where, data },
      expect.any(Object)
    );
  });

  test("lesser privleged user is denied", async () => {
    const workspaceId = casual.uuid;
    const serviceAccountId = casual.uuid;
    const label = casual.title;

    // Mock up a user.
    const user = {
      id: casual.uuid,
      roleBindings: [
        {
          role: WORKSPACE_VIEWER,
          workspace: { id: workspaceId }
        }
      ]
    };

    // Mock up some functions.
    const updateServiceAccount = jest.fn();

    // Construct db object for context.
    const db = {
      mutation: { updateServiceAccount }
    };

    // Vars for the gql mutation.
    const vars = {
      serviceAccountUuid: serviceAccountId,
      payload: {
        label,
        entityType: ENTITY_WORKSPACE,
        entityId: workspaceId
      }
    };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db, user }, vars);
    expect(res.errors).toHaveLength(1);
    expect(updateServiceAccount).toHaveBeenCalledTimes(0);
  });

  test("invalid fields are ignored", async () => {
    const workspaceId = casual.uuid;
    const serviceAccountId = casual.uuid;
    const label = casual.title;
    const invalidField = casual.title;

    // Mock up a user.
    const user = {
      id: casual.uuid,
      roleBindings: [
        {
          role: WORKSPACE_ADMIN,
          workspace: { id: workspaceId }
        }
      ]
    };

    // Mock up some functions.
    const updateServiceAccount = jest.fn();

    // Construct db object for context.
    const db = {
      mutation: { updateServiceAccount }
    };

    // Vars for the gql mutation.
    const vars = {
      serviceAccountUuid: serviceAccountId,
      payload: {
        label,
        invalidField,
        entityType: ENTITY_WORKSPACE,
        entityId: workspaceId
      }
    };

    const where = { id: serviceAccountId };
    const data = { label };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db, user }, vars);
    expect(res.errors).toBeUndefined();
    expect(updateServiceAccount).toHaveBeenCalledTimes(1);
    expect(updateServiceAccount).toHaveBeenCalledWith(
      { where, data },
      expect.any(Object)
    );
  });
});
