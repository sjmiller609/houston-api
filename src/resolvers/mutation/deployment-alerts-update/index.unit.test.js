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
  mutation deploymentAlertsUpdate(
    $deploymentUuid: Uuid!
    $alertEmails: [String!]
  ) {
    deploymentAlertsUpdate(
      deploymentUuid: $deploymentUuid
      alertEmails: $alertEmails
    ) {
        id
      }
    }
`;

describe("deploymentAlertsUpdate", () => {
  test("typical request is successful", async () => {
    // Create some deployment vars.
    const id = casual.uuid;

    // Mock up some db functions.
    const updateDeployment = jest.fn().mockReturnValue({
      id
    });

    const db = {
      mutation: { updateDeployment }
    };

    // Vars for the gql mutation.
    const newAlertEmail = casual.email;
    const vars = {
      deploymentUuid: id,
      alertEmails: [newAlertEmail]
    };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db }, vars);
    expect(res.errors).toBeUndefined();
    expect(updateDeployment.mock.calls.length).toBe(1);
    expect(res.data.deploymentAlertsUpdate.id).toBe(id);
  });
});
