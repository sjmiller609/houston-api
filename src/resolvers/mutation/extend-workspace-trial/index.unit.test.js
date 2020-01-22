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
  mutation extendWorkspaceTrial(
    $workspaceUuid: Uuid!
    $extraDays: Int!
  ) {
    extendWorkspaceTrial(
      workspaceUuid: $workspaceUuid,
      extraDays: $extraDays,
    ) {
      id
      description
      label
    }
  }
`;

describe("extendWorkspaceTrial", () => {
  test("typical request is successful", async () => {
    // Mock up some functions.
    const extraDays = Math.floor(Math.random());
    const updateWorkspace = jest.fn();
    const workspace = jest.fn().mockReturnValue({ trialEndsAt: casual.date });

    // Construct db object for context.
    const db = {
      query: { workspace },
      mutation: { updateWorkspace }
    };

    // Vars for the gql mutation.
    const vars = {
      workspaceUuid: casual.uuid,
      extraDays
    };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db }, vars);
    expect(res.errors).toBeUndefined();
    expect(updateWorkspace.mock.calls).toHaveLength(1);
  });
});
