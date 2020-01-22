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
  mutation updateCard(
    $workspaceUuid: Uuid!
    $billingEmail: String!
    $company: String
    $token: String!
  ) {
    updateCard(
      workspaceUuid: $workspaceUuid
      billingEmail: $billingEmail
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

describe("updateCard", () => {
  test("typical request is successful", async () => {
    const card = {
      name: casual.name,
      exp_month: "01",
      exp_year: "2019",
      last4: "0000",
      brand: casual.card_type,
      email: casual.email,
      metadata: { company: casual.word }
    };

    const stripeCustomerId = casual.uuid;

    // Mock up some functions.
    const workspace = jest.fn().mockReturnValue({
      stripeCustomerId
    });

    // Construct db object for context.
    const db = {
      query: { workspace }
    };

    nock("https://api.stripe.com")
      .post("/v1/customers/" + stripeCustomerId)
      .reply(200, {
        id: casual.uuid,
        sources: {
          data: [card]
        }
      });

    // Vars for the gql mutation.
    const vars = {
      workspaceUuid: casual.uuid,
      billingEmail: casual.email,
      company: casual.word,
      token: casual.string
    };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db }, vars);
    expect(res.errors).toBeUndefined();
    expect(workspace.mock.calls.length).toBe(1);
  });
  test("typical request is unsuccessful", async () => {
    const stripeCustomerId = casual.uuid;

    const workspace = jest.fn().mockReturnValue({
      stripeCustomerId
    });

    // Construct db object for context.
    const db = {
      query: { workspace }
    };

    nock("https://api.stripe.com")
      .post("/v1/customers/" + stripeCustomerId)
      .reply(400, {
        error: {
          message: casual.text,
          type: casual.word
        }
      });

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
