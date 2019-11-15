import validateEnvironment from "./environment";
import validateResources from "./resources";
import validateProperties from "./properties";
import validateExistence from "./existence";
import { auToResources } from "deployments/config";
import config from "config";
import { get, find } from "lodash";
import { AIRFLOW_EXECUTOR_DEFAULT } from "constants";

/*
 * Validate deployment args. Throws if there is an issue.
 * @param {Object} args The graphql arguments.
 */
export default async function validate(workspaceId, args, deployment = {}) {
  // Grab deployment id. This will be undefined when creating a new deployment
  // and will be be populated for an update.
  const deploymentId = deployment.id;

  // Validate environment variables.
  validateEnvironment(args.env);

  // Get list of valid executors in the system.
  const { executors } = config.get("deployments");

  // Get the executor on this deployment.
  const executor = get(deployment, "config.executor", AIRFLOW_EXECUTOR_DEFAULT);

  // Get the configuration for that executor.
  const executorConfig = find(executors, ["name", executor]);

  // Validate resources.
  const { astroUnit, maxPodAu } = config.get("deployments");
  const max = auToResources(astroUnit, maxPodAu, false);
  const defaultAU = executorConfig.defaultExtraAu;
  validateResources(args.config, max, defaultAU, args.properties);

  // Validate properties.
  validateProperties(args.properties);

  // Ensure this deployment label does not exist.
  args.label &&
    (await validateExistence(workspaceId, args.label, deploymentId));
}
