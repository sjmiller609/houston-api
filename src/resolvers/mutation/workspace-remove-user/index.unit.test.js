import resolvers from "resolvers";
import casual from "casual";
import { graphql } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { importSchema } from "graphql-import";

// Import our application schema
const schema = makeExecutableSchema({
  typeDefs: importSchema("src/schema.graphql"),
  resolvers
});

jest.mock("emails");

const query = `
  mutation workspaceRemoveUser(
    $workspaceUuid: Uuid!
    $userUuid: Uuid!
  ) {
    workspaceRemoveUser(
      workspaceUuid: $workspaceUuid
      userUuid: $userUuid
    ) {
      id
    }
  }
`;

describe("workspaceRemoveUser", () => {
  test("removes the workspace role binding", async () => {
    // Create mock user.
    const workspaceUuid = casual.uuid;
    const userUuid = casual.uuid;

    // Mock up some db functions.
    const deleteManyRoleBindings = jest.fn();
    const workspace = jest.fn();

    // Construct db object for context.
    const db = {
      query: { workspace },
      mutation: { deleteManyRoleBindings }
    };

    const vars = {
      workspaceUuid,
      userUuid
    };

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, { db }, vars);
    expect(res.errors).toBeUndefined();

    const where = { workspace: { id: workspaceUuid }, user: { id: userUuid } };
    expect(deleteManyRoleBindings).toHaveBeenCalledWith({ where });
    expect(workspace).toHaveBeenCalled();
  });
});
