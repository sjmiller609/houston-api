import resolvers from "resolvers";
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
  query deploymentConfig(
    $workspaceUuid: Uuid
    $deploymentUuid: Uuid
    $type: String
    $version: String
  ) {
    deploymentConfig(
      workspaceUuid: $workspaceUuid
      deploymentUuid: $deploymentUuid
      type: $type
      version: $version
    ) {
      defaults
      limits
      astroUnit {
        cpu
        memory
        pods
        airflowConns
        actualConns
        price
      }
      maxExtraAu
      executors
      singleNamespace
      loggingEnabled
      latestVersion
      airflowImages {
        version
        tag
      }
      airflowVersions
      defaultAirflowImageTag
      defaultAirflowChartVersion
    }
  }
`;

describe("deploymentConfig", () => {
  test("typical request is successful", async () => {
    // Run the graphql mutation.
    const { data, errors } = await graphql(schema, query);
    expect(errors).toBeUndefined();
    expect(data.deploymentConfig).toHaveProperty("defaults");
    expect(data.deploymentConfig).toHaveProperty("limits");
    expect(data.deploymentConfig).toHaveProperty("astroUnit");
    expect(data.deploymentConfig).toHaveProperty("maxExtraAu");
    expect(data.deploymentConfig).toHaveProperty("executors");
    expect(data.deploymentConfig).toHaveProperty("latestVersion");
    expect(data.deploymentConfig).toHaveProperty("singleNamespace");
    expect(data.deploymentConfig).toHaveProperty("loggingEnabled");
    expect(data.deploymentConfig).toHaveProperty("airflowImages");
    expect(data.deploymentConfig).toHaveProperty("airflowVersions");
    expect(data.deploymentConfig).toHaveProperty("defaultAirflowImageTag");
    expect(data.deploymentConfig).toHaveProperty("defaultAirflowChartVersion");
  });
});
