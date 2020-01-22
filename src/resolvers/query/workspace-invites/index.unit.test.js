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
  query workspaceInvites(
    $workspaceUuid: Uuid!
    $email: String
  ) {
    workspaceInvites(
      workspaceUuid: $workspaceUuid
      email: $email
    ) {
      id
      email
      token
      createdAt
      updatedAt
    }
  }
`;

describe("invites", () => {
  test("typical request is successful", async () => {
    // Mock up some db functions.
    const inviteTokens = jest.fn();

    // Construct db object for context.
    const db = {
      query: {
        inviteTokens
      }
    };

    const vars = {
      workspaceUuid: casual.uuid,
      email: casual.email
    };

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, { db }, vars);
    expect(res.errors).toBeUndefined();
    expect(inviteTokens.mock.calls.length).toBe(1);
  });
});
