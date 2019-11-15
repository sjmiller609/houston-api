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
  query deployments {
    deployments {
      id
      label
      description
      type
      releaseName
      version
      workspace {
        id: uuid
      }
      urls {
        type
        url
      }
      createdAt
      updatedAt
      config
      env
      properties
    }
  }
`;

describe("deployments", () => {
  test("typical request is successful", async () => {
    const user = {
      id: casual.uuid,
      roleBindings: [{ role: "SYSTEM_ADMIN" }]
    };

    // Mock up some db functions.
    const deployments = jest.fn();

    // Construct db object for context.
    const db = {
      query: {
        deployments
      }
    };

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, { db, user });
    expect(res.errors).toBeUndefined();
    expect(deployments.mock.calls.length).toBe(1);
  });
});
