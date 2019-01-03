import {
  generateReleaseName,
  generateNamespace,
  transformEnvironmentVariables,
  generateEnvironmentSecretName
} from "deployments";
import { pick, map, filter, startsWith } from "lodash";
import crypto from "crypto";
import * as constants from "constants";

/*
 * Create a deployment.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {Deployment} The newly created Deployment.
 */
export default async function createDeployment(parent, args, ctx, info) {
  console.log(args);

  // Generate a unique registry password for this deployment.
  const registryPassword = crypto.randomBytes(16).toString("hex");

  // Generate a random space-themed release name.
  const releaseName = generateReleaseName();

  // Filter down whitelisted deployment properties.
  const allowedProps = filter(constants, (_, name) =>
    startsWith(name, "DEPLOYMENT_PROPERTY")
  );

  // Remove any invalid properties.
  const validProps = args.properties ? pick(args.properties, allowedProps) : {};

  // Generate a list of properties to add to mutation.
  const properties = map(validProps, (val, key) => ({
    key,
    value: val.toString()
  }));

  // Create the base mutation.
  const mutation = {
    data: {
      type: args.type,
      version: args.version,
      label: args.label,
      description: args.description,
      config: JSON.stringify(args.config),
      releaseName,
      registryPassword,
      properties: { create: properties }
    }
  };

  // Run the mutation.
  const deployment = ctx.db.mutation.createDeployment(mutation, info);

  // Set secrets via commander.
  const res = await ctx.commander("setSecret", {
    release_name: releaseName,
    namespace: generateNamespace(releaseName),
    secret: {
      name: generateEnvironmentSecretName(releaseName),
      data: transformEnvironmentVariables(args.env)
    }
  });

  console.log(res);

  // Return tbe deployment.
  return deployment;
}
