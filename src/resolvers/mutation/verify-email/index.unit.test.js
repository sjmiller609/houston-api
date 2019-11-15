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
const mutation = `
  mutation verifyEmail(
    $email: String!
  ) {
    verifyEmail(
      email: $email
    )
  }
`;

describe("verifyEmail", () => {
  test("typical request is successful", async () => {
    const email = casual.email;

    // Mock up some functions.
    const updateEmail = jest.fn();

    // Construct db object for context.
    const db = {
      mutation: { updateEmail }
    };

    // Vars for the gql mutation.
    const vars = {
      email
    };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db }, vars);
    expect(res.errors).toBeUndefined();
    expect(updateEmail).toHaveBeenCalledTimes(1);
  });
});
