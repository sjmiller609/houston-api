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
  mutation addCustomerId(
    $workspaceUuid: Uuid!
    $stripeCustomerId: String!
  ) {
    addCustomerId(
      workspaceUuid: $workspaceUuid,
      stripeCustomerId: $stripeCustomerId
    ) {
      label
      stripeCustomerId
    }
  }
`;

describe("addCustomerId", () => {
  test("typical request is successful", async () => {
    // Mock up some functions.
    const updateWorkspace = jest.fn();

    // Construct db object for context.
    const db = {
      mutation: { updateWorkspace }
    };
    // Vars for the gql mutation.
    const vars = {
      workspaceUuid: casual.uuid,
      stripeCustomerId: casual.uuid
    };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db }, vars);
    expect(res.errors).toBeUndefined();
    expect(updateWorkspace.mock.calls.length).toBe(1);
  });
});
