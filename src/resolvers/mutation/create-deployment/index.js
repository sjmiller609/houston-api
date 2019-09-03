import { deploymentFragment, workspaceFragment } from "./fragment";
import {
  generateReleaseName,
  generateNamespace,
  generateDeploymentLabels,
  generateEnvironmentSecretName
} from "deployments/naming";
import { createDatabaseForDeployment } from "deployments/database";
import {
  arrayOfKeyValueToObject,
  generateHelmValues,
  mapPropertiesToDeployment,
  generateDefaultDeploymentConfig
} from "deployments/config";
import validate from "deployments/validate";
import { WorkspaceSuspendedError, TrialError } from "errors";
import { addFragmentToInfo } from "graphql-binding";
import config from "config";
import bcrypt from "bcryptjs";
import { get, find, size } from "lodash";
import crypto from "crypto";
import {
  DEPLOYMENT_AIRFLOW,
  DEPLOYMENT_PROPERTY_EXTRA_AU,
  AIRFLOW_EXECUTOR_CELERY
} from "constants";

/*
 * Create a deployment.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {Deployment} The newly created Deployment.
 */
export default async function createDeployment(parent, args, ctx, info) {
  const {
    releaseVersion: platformReleaseVersion,
    releaseName: platformReleaseName
  } = config.get("helm");

  // Get executor config
  const { executors } = config.get("deployments");
  const executor = get(args, "config.executor", AIRFLOW_EXECUTOR_CELERY);
  const executorConfig = find(executors, ["name", executor]);

  const where = { id: args.workspaceUuid };
  // Throw an error if stripe is enabled (Cloud only) and a stripeCustomerId does not exist in the Workspace table
  const workspace = await ctx.db.query.workspace({ where }, workspaceFragment);

  const stripeEnabled = config.get("stripe.enabled");

  if (
    workspace.stripeCustomerId == null &&
    stripeEnabled == true &&
    size(workspace.deployments) > 0
  ) {
    throw new TrialError();
  }
  if (workspace.isSuspended == true && stripeEnabled == true) {
    throw new WorkspaceSuspendedError();
  }

  // Grab the default airflow version.
  const defaultAirflowVersion = config.get("deployments.defaultAirflowVersion");

  // Validate deployment args.
  await validate(args.workspaceUuid, args);

  // Default deployment version to platform version.
  const version = get(args, "version", platformReleaseVersion);
  const airflowVersion = get(args, "airflowVersion", defaultAirflowVersion);

  // Generate a unique registry password for this deployment.
  const registryPassword = crypto.randomBytes(16).toString("hex");
  const hashedRegistryPassword = await bcrypt.hash(registryPassword, 10);

  // Generate a unique elasticsearch password for this deployment
  const elasticsearchPassword = crypto.randomBytes(16).toString("hex");
  const hashedElasticsearchPassword = await bcrypt.hash(
    elasticsearchPassword,
    10
  );

  // Generate a random space-themed release name.
  const releaseName = generateReleaseName();

  // Add default props if exists
  const properties = {
    [DEPLOYMENT_PROPERTY_EXTRA_AU]: executorConfig.defaultExtraAu || 0,
    ...args.properties
  };

  // Create the base mutation.
  const mutation = {
    data: {
      label: args.label,
      description: args.description,
      config: args.config || generateDefaultDeploymentConfig(),
      version,
      airflowVersion,
      releaseName,
      registryPassword: hashedRegistryPassword,
      elasticsearchPassword: hashedElasticsearchPassword,
      ...mapPropertiesToDeployment(properties),
      workspace: {
        connect: {
          id: args.workspaceUuid
        }
      }
    }
  };

  // Run the mutation.
  const deployment = await ctx.db.mutation.createDeployment(
    mutation,
    addFragmentToInfo(info, deploymentFragment)
  );

  // Create the role binding for the user.
  // XXX: This was commented out temporarily while we are
  // synthetically generating DEPLOYMENT_* RoleBindings.
  // await ctx.db.mutation.createRoleBinding(
  //   {
  //     data: {
  //       role: DEPLOYMENT_ADMIN,
  //       user: { connect: { id: ctx.user.id } },
  //       deployment: { connect: { id: deployment.id } }
  //     }
  //   },
  //   `{ id }`
  // );

  // Create the database for this deployment.
  const {
    metadataConnection,
    resultBackendConnection
  } = await createDatabaseForDeployment(deployment);

  // Create some ad-hoc values to get passed into helm.
  // These won't be changing so just pass them in on create,
  // and subsequent helm upgrades will use the --reuse-values option.
  const data = { metadataConnection, resultBackendConnection };
  const registry = { connection: { pass: registryPassword } };
  const elasticsearch = { connection: { pass: elasticsearchPassword } };
  const platform = {
    release: platformReleaseName,
    workspace: args.workspaceUuid
  };
  const values = { data, registry, elasticsearch, platform, airflowVersion };

  // Fire off createDeployment to commander.
  await ctx.commander.request("createDeployment", {
    releaseName: releaseName,
    chart: {
      name: DEPLOYMENT_AIRFLOW,
      version: version
    },
    namespace: generateNamespace(releaseName),
    namespaceLabels: generateDeploymentLabels(),
    rawConfig: JSON.stringify(generateHelmValues(deployment, values))
  });

  // If we have environment variables, send to commander.
  // TODO: The createDeployment commander method currently
  // allows you to pass secrets to get created,
  // but the implementation does not quite work.
  // This call can be consolidated once that is fixed up in commander.
  if (args.env) {
    await ctx.commander.request("setSecret", {
      release_name: releaseName,
      namespace: generateNamespace(releaseName),
      secret: {
        name: generateEnvironmentSecretName(releaseName),
        data: arrayOfKeyValueToObject(args.env)
      }
    });
  }

  // Return the deployment.
  return deployment;
}
