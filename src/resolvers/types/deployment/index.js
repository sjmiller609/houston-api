import { hasPermission } from "rbac";
import {
  generateNamespace,
  generateEnvironmentSecretName
} from "deployments/naming";
import {
  objectToArrayOfKeyValue,
  mapDeploymentToProperties,
  findLatestTag,
  generateNextTag
} from "deployments/config";
import { get, map } from "lodash";
import config from "config";
import {
  AIRFLOW_EXECUTOR_CELERY,
  DEPLOYMENT_AIRFLOW,
  ENTITY_DEPLOYMENT
} from "constants";

/*
 * Return a list of important urls for this deployment.
 * @param {Object} parent The result of the parent resolver.
 * @param {[]Object} The list of urls.
 */
export function urls(parent) {
  const { config: cfg, releaseName } = parent;
  const baseDomain = config.get("helm.baseDomain");

  // All deployments will have the airflow url.
  const urls = [
    {
      type: `airflow`,
      url: `https://${releaseName}-airflow.${baseDomain}/`
    }
  ];

  // Celery deployments will also have flower url.
  if (cfg.executor === AIRFLOW_EXECUTOR_CELERY) {
    urls.push({
      type: `flower`,
      url: `https://${releaseName}-flower.${baseDomain}`
    });
  }

  return urls;
}

/*
 * Return a properly formatted list of environment variables.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {[]Object} The environment variables.
 */
export async function env(parent, args, ctx) {
  const { releaseName } = parent;

  // Query commander for the environment variables.
  const envs = await ctx.commander.request("getSecret", {
    namespace: generateNamespace(releaseName),
    name: generateEnvironmentSecretName(releaseName)
  });

  // Transform the returned object into an array.
  return objectToArrayOfKeyValue(get(envs, "secret.data"));
}

/*
 * Return a properly formatted properties object.
 * @param {Object} parent The result of the parent resolver.
 * @return {Object} The legacy properties object.
 */
export async function properties(parent) {
  return mapDeploymentToProperties(parent);
}

/*
 * Return the default type.
 * @return {String} The deployment type.
 */
export function type() {
  return DEPLOYMENT_AIRFLOW;
}

/*
 * Return information about the deployment images.
 * @param {Object} parent The result of the parent resolver.
 * @return {Object} The deployment info.
 */
export async function deployInfo(parent, args, ctx) {
  const images = await ctx.db.query.dockerImages(
    {
      where: { deployment: { id: parent.id }, tag_starts_with: "cli-" }
    },
    `{ tag }`
  );
  const tags = map(images, "tag");
  const latest = findLatestTag(tags);
  const nextCli = generateNextTag(latest);

  const imagesCreated = await ctx.db.query.dockerImages(
    {
      where: { deployment: { id: parent.id } },
      order: [["created", "DESC"]],
      limit: 1
    },
    `{ tag }`
  );
  const current = map(imagesCreated, "tag")[0];
  return { latest, nextCli, current };
}

/*
 * Return boolean flags indicating what the current user has access to
 * on a particular deployment.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {DeploymentCapabilities} Map of boolean capabilities.
 */
export function deploymentCapabilities(parent, args, ctx) {
  // Check to see if user has permission to deploy
  const canDeploy = hasPermission(
    ctx.user,
    "deployment.images.push",
    ENTITY_DEPLOYMENT.toLowerCase(),
    parent.id
  );

  return { canDeploy };
}

export default {
  urls,
  env,
  type,
  properties,
  deployInfo,
  deploymentCapabilities
};
