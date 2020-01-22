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
const query = `
  mutation deleteWorkspaceServiceAccount(
    $serviceAccountUuid: Uuid!
    $workspaceUuid: Uuid!
  ) {
    deleteWorkspaceServiceAccount(
      serviceAccountUuid: $serviceAccountUuid
      workspaceUuid: $workspaceUuid
    ) {
      id
    }
  }
`;

describe("deleteWorkspaceServiceAccount", () => {
  test("typical request is successful", async () => {
    // Create mock user.
    const workspaceId = casual.uuid;

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

    // Mock up some db functions.
    const serviceAccount = jest.fn().mockReturnValue({
      id: casual.id,
      roleBinding: { workspace: { id: workspaceId } }
    });

    const deleteServiceAccount = jest.fn();

    // Construct db object for context.
    const db = {
      query: { serviceAccount },
      mutation: { deleteServiceAccount }
    };

    const vars = {
      serviceAccountUuid: casual.uuid,
      workspaceUuid: workspaceId
    };

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, { db, user }, vars);
    expect(res.errors).toBeUndefined();
    expect(serviceAccount.mock.calls).toHaveLength(1);
    expect(deleteServiceAccount.mock.calls).toHaveLength(1);
  });

  test("request throws if service account is not found", async () => {
    // Create mock user.
    const workspaceId = casual.uuid;

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

    // Mock up some db functions.
    const serviceAccount = jest.fn();
    const deleteServiceAccount = jest.fn();

    // Construct db object for context.
    const db = {
      query: { serviceAccount },
      mutation: { deleteServiceAccount }
    };

    const vars = {
      serviceAccountUuid: casual.uuid,
      workspaceUuid: workspaceId
    };

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, { db, user }, vars);
    expect(res.errors).toHaveLength(1);
    expect(serviceAccount.mock.calls).toHaveLength(1);
    expect(deleteServiceAccount.mock.calls).toHaveLength(0);
  });
});
