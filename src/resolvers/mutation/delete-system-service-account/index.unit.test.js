import resolvers from "resolvers";
import casual from "casual";
import { graphql } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { importSchema } from "graphql-import";
import { SYSTEM_ADMIN } from "constants";

// Import our application schema
const schema = makeExecutableSchema({
  typeDefs: importSchema("src/schema.graphql"),
  resolvers
});

// Define our mutation
const query = `
  mutation deleteSystemServiceAccount(
    $serviceAccountUuid: Uuid!
  ) {
    deleteSystemServiceAccount(
      serviceAccountUuid: $serviceAccountUuid
    ) {
      id
    }
  }
`;

describe("deleteSystemServiceAccount", () => {
  test("typical request is successful", async () => {
    // Create mock user.
    const user = {
      id: casual.uuid,
      username: casual.email,
      roleBindings: [
        {
          role: SYSTEM_ADMIN
        }
      ]
    };

    // Mock up some db functions.
    const serviceAccount = jest.fn().mockReturnValue({
      id: casual.id
    });

    const deleteServiceAccount = jest.fn();

    // Construct db object for context.
    const db = {
      query: { serviceAccount },
      mutation: { deleteServiceAccount }
    };

    const vars = {
      serviceAccountUuid: casual.uuid
    };

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, { db, user }, vars);
    expect(res.errors).toBeUndefined();
    expect(deleteServiceAccount).toHaveBeenCalledWith(
      { where: { id: vars.serviceAccountUuid } },
      expect.any(Object)
    );
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
          role: SYSTEM_ADMIN,
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
