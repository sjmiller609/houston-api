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
  mutation createWorkspace(
    $label: String!
    $description: String
  ) {
    createWorkspace(
      label: $label
      description: $description
    ) {
      id
      label
      description
    }
  }
`;

describe("createWorkspace", () => {
  test("typical request is successful", async () => {
    // Create mock user.
    const user = { id: casual.uuid };

    // Mock up some db functions.
    const createWorkspace = jest.fn();

    // Construct db object for context.
    const db = { mutation: { createWorkspace } };

    // Create args.
    const vars = {
      label: casual.word,
      description: casual.description
    };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db, user }, vars);
    expect(res.errors).toBeUndefined();
    expect(createWorkspace.mock.calls.length).toBe(1);
  });
});
