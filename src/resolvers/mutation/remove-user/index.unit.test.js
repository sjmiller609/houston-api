import { returnUserFragment } from "./fragment";
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

jest.mock("emails");

const query = `
  mutation removeUser($userUuid: Uuid!) {
    removeUser(userUuid: $userUuid) {
      id: uuid
    }
  }
`;

describe("removeUser", () => {
  test("removes the user role binding", async () => {
    // Create mock user.
    const userUuid = casual.uuid;

    // Mock up some db functions.
    const user = jest.fn().mockReturnValue({ roleBindings: [] });
    const deleteUser = jest.fn();

    // Construct db object for context.
    const db = {
      query: { user },
      mutation: { deleteUser }
    };

    const vars = {
      userUuid
    };

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, { db }, vars);
    expect(res.errors).toBeUndefined();

    const where = { id: userUuid };
    expect(deleteUser).toHaveBeenCalledWith({ where }, returnUserFragment);
  });

  test("throws error if there are no other system admins", async () => {
    // Create mock user.
    const userUuid = casual.uuid;

    // Mock up some db functions.
    const user = jest
      .fn()
      .mockReturnValue({ roleBindings: [{ role: SYSTEM_ADMIN }] }); // User is an admin
    const roleBindings = jest.fn().mockReturnValue([]); // No other admins
    const deleteUser = jest.fn();

    // Construct db object for context.
    const db = {
      query: { user, roleBindings },
      mutation: { deleteUser }
    };

    const vars = {
      userUuid
    };

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, { db }, vars);
    expect(res.errors).toHaveLength(1);
    expect(deleteUser).toHaveBeenCalledTimes(0);
  });

  test("does not throw error if there are more admins", async () => {
    // Create mock user.
    const userUuid = casual.uuid;

    // Mock up some db functions.
    const user = jest
      .fn()
      .mockReturnValue({ roleBindings: [{ role: SYSTEM_ADMIN }] }); // User is an admin
    const roleBindings = jest.fn().mockReturnValue([{}, {}]); // More admins
    const deleteUser = jest.fn();

    // Construct db object for context.
    const db = {
      query: { user, roleBindings },
      mutation: { deleteUser }
    };

    const vars = {
      userUuid
    };

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, { db }, vars);
    expect(res.errors).toBeUndefined();

    const where = { id: userUuid };
    expect(deleteUser).toHaveBeenCalledWith({ where }, returnUserFragment);
  });
});
