import fragment from "./fragment";
import { addFragmentToInfo } from "graphql-binding";
import { compact } from "lodash";

/*
 * Get list of deployments for a workspace.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {[]Deployment} List of Deployments.
 */
export default async function workspaceDeployments(parent, args, ctx, info) {
  // Build the deployments query.
  const query = deploymentsQuery(args, ctx);

  // Run final query
  return await ctx.db.query.deployments(
    query,
    addFragmentToInfo(info, fragment)
  );
}

/*
 * Build the deployments query based on args.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {Object} The deployments query.
 */
export function deploymentsQuery(args, ctx) {
  // Pull out some args.
  const { releaseName, workspaceUuid } = args;

  // Build query structure.
  let query = { where: { AND: [] } };

  // If we have releaseName, add to filter.
  if (releaseName) {
    query.where.AND.push({ releaseName });
  }

  // If we have workspaceUuid, add to filter.
  if (workspaceUuid) {
    query.where.AND.push({ workspace: { id: workspaceUuid } });
  }

  if (!(releaseName || workspaceUuid)) {
    // Get a list of deployment ids that this user can access.
    const deploymentIds = ctx.user.roleBindings.map(rb =>
      rb.deployment ? rb.deployment.id : null
    );
    query.where.AND.push({ id_in: compact(deploymentIds) });
  }

  // Exclude soft-deleted deployments
  query.where.AND.push({ deletedAt: null });

  // Return the final query.
  return query;
}
