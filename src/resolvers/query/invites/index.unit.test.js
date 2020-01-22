import resolvers from "resolvers";
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
  query invites {
    invites {
      id: uuid
      email
      role
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

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, { db });
    expect(res.errors).toBeUndefined();
    expect(inviteTokens.mock.calls.length).toBe(1);
  });
});
