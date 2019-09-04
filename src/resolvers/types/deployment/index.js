import log from "logger";
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
import { createDockerJWT } from "registry/jwt";
import { get } from "lodash";
import config from "config";
import request from "request-promise-native";
import { NOT_FOUND } from "http-status-codes";
import { AIRFLOW_EXECUTOR_CELERY, DEPLOYMENT_AIRFLOW } from "constants";

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
export async function deployInfo(parent) {
  // Build the repo name.
  const repo = `${parent.releaseName}/${DEPLOYMENT_AIRFLOW}`;

  // Create a JWT for the registry request.
  const dockerJWT = await createDockerJWT("houston", [
    {
      type: "repository",
      name: repo,
      actions: ["push", "pull"]
    }
  ]);

  // Grab some configuration.
  const {
    releaseNamespace: namespace,
    releaseName: platformReleaseName
  } = config.get("helm");
  const registryPort = config.get("registry.port");

  // Build the registry request URL.
  const uri = `http://${platformReleaseName}-registry.${namespace}:${registryPort}/v2/${repo}/tags/list`;
  log.debug(`Requesting docker tags for ${parent.releaseName} at ${uri}`);

  try {
    // Request a list of tags.
    const repo = await request({
      method: "GET",
      uri,
      json: true,
      headers: { Authorization: `Bearer ${dockerJWT}` }
    });

    // Generate the response based on list.
    const latest = findLatestTag(repo.tags);
    const next = generateNextTag(latest);
    return { latest, next };
  } catch (err) {
    // If we get a 404, that means nobody has pushed yet, so just return empty.
    if (err.statusCode === NOT_FOUND) return {};

    // Otherwise throw the actual error.
    throw err;
  }
}

export default { urls, env, type, properties, deployInfo };
