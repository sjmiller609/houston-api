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

// Define our query
const query = `
  query card(
    $workspaceUuid: Uuid!
    $stripeCustomerId: String!
  ) {
    card(
      workspaceUuid: $workspaceUuid
      stripeCustomerId: $stripeCustomerId
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

describe("card", () => {
  test("typical request is successful", async () => {
    const card = {
      name: casual.name,
      exp_month: "01",
      exp_year: "2019",
      last4: "0000",
      brand: casual.card_type
    };
    const stripeCustomerId = casual.uuid;

    nock("https://api.stripe.com")
      .get("/v1/customers/" + stripeCustomerId)
      .reply(200, {
        id: casual.uuid,
        sources: {
          data: [card]
        },
        metadata: { company: casual.word }
      });

    const vars = {
      workspaceUuid: casual.uuid,
      stripeCustomerId
    };

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, {}, vars);
    expect(res.errors).toBeUndefined();
  });
  test("typical request is unsuccessful", async () => {
    const stripeCustomerId = casual.uuid;

    nock("https://api.stripe.com")
      .get("/v1/customers/" + stripeCustomerId)
      .reply(400, {
        id: casual.uuid,
        error: {
          message: casual.text,
          type: casual.word
        }
      });

    const vars = {
      workspaceUuid: casual.uuid,
      stripeCustomerId
    };

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, {}, vars);
    expect(res.errors).toHaveLength(1);
  });
});
