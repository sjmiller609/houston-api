import resolvers from "resolvers";
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
  query config {
    appConfig {
      version
      baseDomain
    }
  }
`;

describe("appConfig", () => {
  test("typical request is successful", async () => {
    // Construct db object for context.
    const db = {
      query: {}
    };

    // Run the graphql mutation.
    await graphql(schema, query, null, { db });
  });
});
