import { usersQuery } from "./index";
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
  query users(
    $userId: Uuid,
    $username: String,
    $email: String
  ) {
    users(
      userUuid: $userId,
      username: $username,
      email: $email
    ) {
      id
      emails {
        address
        verified
        primary
      }
      fullName
      profile {
        key
        value
        category
      }
      username
      status
    }
  }
`;

describe("users", () => {
  test("typical request is successful", async () => {
    const user = {
      id: casual.uuid,
      roleBindings: [{ deployment: { id: casual.uuid } }]
    };

    // Mock up some db functions.
    const users = jest.fn();

    // Construct db object for context.
    const db = { query: { users } };

    // Create vars.
    const vars = {
      username: casual.username
    };

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, { db, user }, vars);
    expect(res.errors).toBeUndefined();
    expect(users.mock.calls.length).toBe(1);
  });
});

describe("usersQuery", () => {
  test("query using id if supplied", () => {
    const id = casual.uuid;
    const args = { userUuid: id };
    const res = usersQuery(args);
    expect(res).toHaveProperty("where.id", id);
  });

  test("query using username if supplied", () => {
    const username = casual.username;
    const args = { username };
    const res = usersQuery(args);
    expect(res).toHaveProperty("where.username_contains", username);
  });

  test("query using email if supplied", () => {
    const email = casual.email.toLowerCase();
    const args = { email };
    const res = usersQuery(args);
    expect(res).toHaveProperty("where.emails_some.address", email);
  });
});
