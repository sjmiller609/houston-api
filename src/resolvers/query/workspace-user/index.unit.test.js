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

// Define our mutation
const query = `
  query workspaceUser(
    $workspaceId: Uuid!
    $username: String!
  ) {
    workspaceUser(
      workspaceUuid: $workspaceId,
      username: $username
    ) {
      id
      username
    }
  }
`;

describe("workspaceUser", () => {
  // Mock up some db functions.
  const users = jest.fn();

  // Construct db object for context.
  const db = { query: { users } };

  // Create vars.
  const vars = {
    workspaceId: casual.uuid,
    username: casual.word
  };

  test("when user exists", async () => {
    // Run the graphql mutation.
    users.mockReturnValueOnce([{ id: casual.uuid, username: vars.username }]);

    const res = await graphql(schema, query, null, { db }, vars);
    expect(res.errors).toBeUndefined();
    expect(db.query.users).toHaveBeenCalled();
  });

  test("when user not in workspace", async () => {
    // Run the graphql mutation.
    users.mockReturnValueOnce([]);

    const res = await graphql(schema, query, null, { db }, vars);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0]).toHaveProperty(
      "extensions.code",
      "RESOURCE_NOT_FOUND"
    );
    expect(db.query.users).toHaveBeenCalled();
  });
});
