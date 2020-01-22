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
import moment from "moment";
import { map, size } from "lodash";
import { DEPLOYMENT_AIRFLOW, MEDIATYPE_DOCKER_MANIFEST_V2 } from "constants";

/*
 * Get manifest from docker registry api for selected tag.
 * @param {String} dockerJWT JWT token for docker registry API.
 * @param {String} registry name of the registry.
 * @param {String} repo name of the repository in registry.
 * @param {String} tag name of the tag.
 * @return {String} docker content digest hash.
 */
async function getManifestForTag(dockerJWT, registry, repo, tag) {
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
  log.debug(`Deleting ${digestHash}: DELETE ${uri}`);
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
  const { host, port } = config.get("registry");
  const registry = `${host}:${port}`;

  const releaseName = deployment.releaseName;
  const repo = `${releaseName}/${DEPLOYMENT_AIRFLOW}`;

  log.info(`Cleaning docker registry ${repo}`);

  // Create a JWT for the registry request.
  let dockerJWT;

  try {
    dockerJWT = createDockerJWT("houston", [
      {
        type: "repository",
        // Build the repo name.
        name: repo,
        actions: ["pull", "delete"]
      }
    ]);
  } catch (e) {
    return log.info(
      `Could not create registry JWT, skipping registry cleanup for ${repo}`
    );
  }

  // Build the registry request URL for tag list.
  const uri = `http://${registry}/v2/${repo}/tags/list`;

  log.debug(`Requesting docker tags for ${releaseName} at ${uri}`);

  // Docker tags to delete.
  let tags;

  // Try to get all the tags from the registry.
  // This could fail due to never being pushed to.
  try {
    const response = await request({
      method: "GET",
      uri,
      json: true,
      headers: { Authorization: `Bearer ${dockerJWT}` }
    });

    tags = response.tags;
  } catch (e) {
    log.error(e);
  }

  // Exit early if we have no tags.
  if (size(tags) === 0) {
    log.info("There are no tags to delete");
    return;
  }

  // Delete each tag.
  for (const tag of tags) {
    try {
      const digestHash = await getManifestForTag(
        dockerJWT,
        registry,
        repo,
        tag
      );
      await deleteManifest(dockerJWT, registry, repo, digestHash);
    } catch (e) {
      log.error(e);
    }
  }

  log.info(`Cleaned ${repo}`);
}

/*
 * Cleanup soft deleted deployments
 */
async function cleanupDeployments() {
  log.info("Starting deployment cleanup");
  // Get the cutoff date.
  const olderThan = moment()
    .subtract(argv["olderThan"], "days")
    .toDate();

  log.info(`Searching for deployments soft-deleted before ${olderThan}`);

  // Build the deployment query.
  const query = { where: { deletedAt_lte: olderThan } };

  if (argv["canary"]) {
    log.info(`Limiting search to canary deployments`);
    query.where = { ...query.where, canary: true };
  }

  log.debug(`Query: ${JSON.stringify(query)}`);

  // Find the deployments that are older than cleanup
  const deployments = await prisma
    .deployments(query)
    .$fragment(`{ releaseName }`);

  const deploymentCount = size(deployments);

  // Log deployment info if we have some to expire
  if (deploymentCount > 0) {
    const names = map(deployments, "releaseName").join(", ");
    log.info(`Found ${size(deployments)} deployments to cleanup: ${names}`);
  } else {
    // Return early if we have no deployments.
    log.info("No deployments to cleanup, exiting now");
    return;
  }

  // Exit now if dry-run.
  if (argv["dry-run"]) {
    log.info("This is a dry-run, skipping deployment cleanup and exiting now");
    return;
  }

  // Loop through the deployments and cleanup.
  for (const deployment of deployments) {
    log.info(`Beginning cleanup for ${deployment.releaseName}`);
    await removeDatabaseForDeployment(deployment);
    await cleanupImagesForDeployment(deployment);
    await prisma.deleteDeployment({
      releaseName: deployment.releaseName
    });
  }
}

const argv = yargs
  .option("older-than", {
    alias: "o",
    default: 14,
    description: "Filter soft deleted deployments older than",
    type: "number"
  })
  .option("dry-run", {
    alias: "d",
    default: false,
    description:
      "Skip actual cleanup and only print the deployments that would be cleaned up",
    type: "boolean"
  })
  .option("canary", {
    alias: "c",
    default: false,
    description: "Only run for deployments with canary flag set to true",
    type: "boolean"
  })
  .help()
  .alias("help", "h").argv;

// When a file is run directly from Node, require.main is set to its module.
if (require.main === module) {
  cleanupDeployments().catch(e => {
    log.error(e);
  });
}
