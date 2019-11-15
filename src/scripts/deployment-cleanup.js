/*
 * Script clean up registry and related airflow databases
 */
import "dotenv/config";
import log from "logger";
import { version } from "utilities";
import { createDockerJWT } from "registry/jwt";
import { prisma } from "generated/client";
import { removeDatabaseForDeployment } from "deployments/database";
import request from "request-promise-native";
import config from "config";
import yargs from "yargs";
import { DEPLOYMENT_AIRFLOW, MEDIATYPE_DOCKER_MANIFEST_V2 } from "constants";

/*
 * Get manifest from docker registry api for selected tag.
 * @param {String} dockerJWT JWT token for docker registry API.
 * @param {String} registry name of the registry.
 * @param {String} repo name of the repository in registry.
 * @param {String} tag name of the tag.
 * @return {String} docker content digest hash.
 */
async function getManifestoForSelectedTag(dockerJWT, registry, repo, tag) {
  const uri = `http://${registry}/v2/${repo}/manifests/${tag}`;
  log.debug(`Requesting docker tag manifest for ${uri} at ${tag}`);
  const response = await request({
    method: "GET",
    uri,
    json: true,
    resolveWithFullResponse: true,
    headers: {
      Authorization: `Bearer ${dockerJWT}`,
      Accept: MEDIATYPE_DOCKER_MANIFEST_V2
    }
  });
  return response.headers["docker-content-digest"];
}

/*
 * Delete manifest from docker registry for selected digest hash.
 * @param {String} dockerJWT JWT token for docker registry API.
 * @param {String} registry name of the registry.
 * @param {String} repo name of the repository in registry.
 * @param {String} digestHash hash digest of docker layer.
 */
async function deleteManifest(dockerJWT, registry, repo, digestHash) {
  const uri = `http://${registry}/v2/${repo}/manifests/${digestHash}`;
  log.debug(`deleting ${digestHash}: DELETE ${uri}`);
  await request({
    method: "DELETE",
    uri,
    json: true,
    headers: {
      Authorization: `Bearer ${dockerJWT}`,
      "User-Agent": `houston/${version()}`
    }
  });
}

/*
 * Remove images from docker registry for selected deployment.
 * @param {String} deployment name of the deployment.
 */
async function cleanupImagesForDeployment(deployment) {
  const {
    releaseNamespace: namespace,
    releaseName: platformReleaseName
  } = config.get("helm");
  const registryPort = config.get("registry.port");
  const releaseName = deployment.releaseName;
  const repo = `${releaseName}/${DEPLOYMENT_AIRFLOW}`;
  const registry = `${platformReleaseName}-registry.${namespace}:${registryPort}`;

  // Create a JWT for the registry request.
  const dockerJWT = createDockerJWT("houston", [
    {
      type: "repository",
      // Build the repo name.
      name: repo,
      actions: ["pull", "delete"]
    }
  ]);

  // Build the registry request URL for tag list.
  const uri = `http://${registry}/v2/${repo}/tags/list`;

  log.debug(`Requesting docker tags for ${releaseName} at ${uri}`);
  const { tags } = await request({
    method: "GET",
    uri,
    json: true,
    headers: { Authorization: `Bearer ${dockerJWT}` }
  });

  if (tags.length === 0) {
    log.info("There is no tags to delete :(");
    return;
  }
  for (const tag of tags) {
    // For each tag create record
    const digestHash = await getManifestoForSelectedTag(
      dockerJWT,
      registry,
      repo,
      tag
    );
    await deleteManifest(dockerJWT, registry, repo, digestHash);
  }
}

/*
 * Cleanup soft deleted deployments
 */
async function deploymentCleanup() {
  log.info("Starting registry cleanup");
  const olderDate = new Date();
  olderDate.setDate(olderDate.getDate() - argv["olderThan"]);
  const deployments = await prisma.deployments(
    { where: { deletedAt_lte: olderDate } },
    `{ releaseName }`
  );
  if (deployments.length === 0) {
    log.info("There is no deployments to delete :(");
    return;
  }
  for (const deployment of deployments) {
    await cleanupImagesForDeployment(deployment);
    await prisma.deleteDeployment({ where: { releaseName: deployment } });
    await removeDatabaseForDeployment(deployment);
  }
}

const argv = yargs
  .option("older-than", {
    alias: "o",
    default: 14,
    description: "Filter soft deleted deployments older than",
    type: "number"
  })
  .help()
  .alias("help", "h").argv;

// When a file is run directly from Node, require.main is set to its module.
if (require.main === module) {
  deploymentCleanup().catch(err => {
    log.error(err);
  });
}
