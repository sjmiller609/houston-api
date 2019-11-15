import resolvers from "resolvers";
import { generateReleaseName } from "deployments/naming";
import casual from "casual";
import config from "config";
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
  mutation deleteDeployment(
    $deploymentUuid: Uuid!
  ) {
    deleteDeployment(
      deploymentUuid: $deploymentUuid
    ) {
        id
    }
  }
`;

describe("deleteDeployment", () => {
  let id, updateDeployment, db, commander, vars;

  beforeEach(() => {
    // Create some deployment vars.
    id = casual.uuid;

    // Mock up some db functions.
    updateDeployment = jest.fn().mockReturnValue({
      id,
      releaseName: generateReleaseName()
    });

    // Construct db object for context.
    db = {
      mutation: { updateDeployment }
    };

    // Create mock commander client.
    commander = {
      request: jest.fn()
    };

    // Vars for the gql mutation.
    vars = {
      deploymentUuid: id
    };
  });

  describe("in normal mode", () => {
    test("typical request is successful", async () => {
      // Run the graphql mutation.
      const res = await graphql(
        schema,
        mutation,
        null,
        { db, commander },
        vars
      );

      expect(res.errors).toBeUndefined();
      expect(updateDeployment).toBeCalledTimes(1);
      expect(updateDeployment).toBeCalledWith(
        {
          data: { deletedAt: expect.any(Date) },
          where: { id }
        },
        expect.anything()
      );
      expect(commander.request.mock.calls.length).toBe(1);
      expect(commander.request.mock.calls[0][0]).toBe("deleteDeployment");
      expect(commander.request.mock.calls[0][1].deleteNamespace).toBe(true);
      expect(res.data.deleteDeployment.id).toBe(id);
    });
  });
  describe("in singleNamespace mode", () => {
    beforeAll(() => (config.helm.singleNamespace = true));
    afterAll(() => (config.helm.singleNamespace = false));
    test("typical request is successful", async () => {
      // Run the graphql mutation.
      const res = await graphql(
        schema,
        mutation,
        null,
        { db, commander },
        vars
      );

      expect(res.errors).toBeUndefined();
      expect(updateDeployment).toBeCalledTimes(1);
      expect(updateDeployment).toBeCalledWith(
        {
          data: { deletedAt: expect.any(Date) },
          where: { id }
        },
        expect.anything()
      );
      expect(commander.request.mock.calls.length).toBe(1);
      expect(commander.request.mock.calls[0][0]).toBe("deleteDeployment");
      expect(commander.request.mock.calls[0][1].deleteNamespace).toBe(false);
      expect(res.data.deleteDeployment.id).toBe(id);
    });
  });
});
