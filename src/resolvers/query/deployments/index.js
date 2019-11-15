import fragment from "./fragment";
import { addFragmentToInfo } from "graphql-binding";

/*
 * Get list of deployments for a system admin user.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {[]Deployment} List of Deployments.
 */
export default async function deployments(parent, args, ctx, info) {
  return await ctx.db.query.deployments(
    { where: { deletedAt: null } },
    addFragmentToInfo(info, fragment)
  );
}
