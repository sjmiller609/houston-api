import resolvers from "resolvers";
import casual from "casual";
import nock from "nock";
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
  mutation addCard(
    $workspaceUuid: Uuid!
    $billingEmail: String!
    $company: String
    $token: String!
  ) {
    addCard(
      workspaceUuid: $workspaceUuid,
      billingEmail: $billingEmail,
      company: $company
      token: $token
    ) {
      name
      expMonth
      expYear
      last4
      brand
      billingEmail
      company
    }
  }
`;

describe("addCard", () => {
  test("typical request is successful", async () => {
    // Mock card data
    const card = {
      name: casual.name,
      exp_month: "01",
      exp_year: "2019",
      last4: "0000",
      brand: casual.card_type,
      email: casual.email,
      metadata: { company: casual.word }
    };

    nock("https://api.stripe.com")
      .post("/v1/customers")
      .reply(200, {
        id: casual.uuid,
        sources: {
          data: [card]
        }
      });

    // Mock up some functions.
    const updateWorkspace = jest.fn();

    // Construct db object for context.
    const db = {
      mutation: { updateWorkspace }
    };
    // Vars for the gql mutation.
    const vars = {
      workspaceUuid: casual.uuid,
      billingEmail: casual.email,
      company: casual.string,
      token: casual.string
    };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db }, vars);
    expect(res.errors).toBeUndefined();
    expect(updateWorkspace.mock.calls.length).toBe(1);
  });
  test("typical request is unsuccessful", async () => {
    nock("https://api.stripe.com")
      .post("/v1/customers/")
      .reply(400, {
        error: {
          message: casual.text,
          type: casual.word
        }
      });

    const updateWorkspace = jest.fn();

    const db = {
      mutation: { updateWorkspace }
    };

    // Vars for the gql mutation.
    const vars = {
      workspaceUuid: casual.uuid,
      billingEmail: casual.email,
      company: casual.word,
      token: casual.string
    };

    const res = await graphql(schema, mutation, null, { db }, vars);
    expect(res.errors).toHaveLength(1);
  });
});
