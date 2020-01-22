/*
 * Script to soft delete expired deployments
 */
import "dotenv/config";
import log from "logger";
import commander from "commander";
import { prisma } from "generated/client";
import { generateNamespace } from "deployments/naming";
import config from "config";
import yargs from "yargs";
import { map, size } from "lodash";
import moment from "moment";

/*
 * Soft deletion of expired deployments
 */
async function expireDeployments() {
  log.info("Starting soft deletion of expired deployments");

  const modifier = argv["date-modifier"];
  const expireDate = moment().add(modifier, "days");

  log.info(`Searching for deployments that expired before ${expireDate}`);

  // Build the deployment query.
  const query = {
    where: {
      deletedAt: null, // We want deployments that have not been soft-deleted yet
      workspace: {
        stripeCustomerId: null, // And where the workspace does not yet have a stripe customer id
        trialEndsAt_lte: expireDate // And where the workpace trial end date has been exceeded
      }
    }
  };

  if (argv["canary"]) {
    log.info(`Limiting search to canary deployments`);
    query.where.canary = true;
  }

  log.debug(`Query: ${JSON.stringify(query)}`);

  // Find all suspended deployments.
  const deployments = await prisma
    .deployments(query)
    .$fragment(`{ id releaseName workspace { id trialEndsAt } }`);

  const deploymentCount = size(deployments);

  // Log deployment info if we have some to expire
  if (deploymentCount > 0) {
    const names = map(deployments, "releaseName").join(", ");
    log.info(`Found ${size(deployments)} deployments to expire: ${names}`);
  } else {
    // Return early if we have no deployments.
    log.info("No deployments to expire, exiting now");
    return;
  }

  // Exit now if dry-run.
  if (argv["dry-run"]) {
    log.info(
      "This is a dry-run, skipping deployment expiration and exiting now"
    );
    return;
  }

  for (const deployment of deployments) {
    // Pull out some deployment fields.
    const { releaseName, id } = deployment;

    log.info(`Soft deleting ${releaseName}`);

    // Update the database.
    await prisma.updateDeployment({
      where: { id },
      data: { deletedAt: new Date() }
    });

    // Delete deployment from helm.
    await commander.request("deleteDeployment", {
      releaseName: deployment.releaseName,
      namespace: generateNamespace(deployment.releaseName),
      deleteNamespace: !config.get("helm.singleNamespace")
    });
  }

  log.info("Soft deletion of expired deployments has been finished!");
}

const argv = yargs
  .option("dry-run", {
    alias: "d",
    default: false,
    description:
      "Skip actual deletion and only print the deployments that would be deleted",
    type: "boolean"
  })
  .option("date-modifier", {
    alias: "m",
    default: 0,
    description:
      "Add or subtract days from the expiration date, which defaults to now",
    type: "number"
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
  expireDeployments().catch(err => {
    log.error(err);
  });
}
