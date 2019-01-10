import validate from "deployments/validate";
import {
  combinePropsForUpdate,
  propertiesObjectToArray
} from "deployments/config";
import { get, merge, pick } from "lodash";

/*
 * Update a deployment.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {Deployment} The updated Deployment.
 */
export default async function updateDeployment(parent, args, ctx, info) {
  // Get the deployment first.
  const deployment = await ctx.db.query.deployment(
    { where: { id: args.deploymentUuid } },
    `{ properties { id, key, value }, workspace { id } }`
  );

  // This should be directly defined in the schema, rather than nested
  // under payload as JSON. This is only here until we can migrate the
  // schema of this mutation. Orbit should also not send non-updatable
  // properties up in the payload.
  // Until we fix these, pick out the args we allow updating on.
  const updatablePayload = pick(args.payload, [
    "label",
    "description",
    "version"
  ]);

  // Munge the args together to resemble the createDeployment mutation.
  // Once we fix the updateDeployment schema to match, we can skip this.
  const mungedArgs = merge({}, updatablePayload, {
    config: args.config,
    env: args.env,
    properties: get(args, "payload.properties", {})
  });

  // Validate our args.
  await validate(deployment.workspace.id, mungedArgs, args.deploymentUuid);

  // Create the update statement.
  const data = merge({}, updatablePayload, {
    config: mungedArgs.config,
    properties: combinePropsForUpdate(
      propertiesObjectToArray(mungedArgs.properties),
      deployment.properties
    )
  });

  // Update the deployment in the database.
  const updatedDeployment = await ctx.db.mutation.updateDeployment(
    {
      where: { id: args.deploymentUuid },
      data
    },
    info
  );

  return updatedDeployment;
}
