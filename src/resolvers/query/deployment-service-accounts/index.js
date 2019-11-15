import fragment from "./fragment";
import { addFragmentToInfo } from "graphql-binding";

/*
 * Get a list of deployment service accounts
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {[ServiceAccount]} The service accounts.
 */
export default async function deploymentServiceAccounts(
  parent,
  args,
  ctx,
  info
) {
  // Pull out some args.
  const { deploymentUuid } = args;

  // Build query structure.
  const query = {
    where: {
      roleBinding: {
        deployment: { id: deploymentUuid }
      }
    }
  };

  // Run final query
  const serviceAccounts = await ctx.db.query.serviceAccounts(
    query,
    addFragmentToInfo(info, fragment)
  );

  // If we made it here, return the service accounts.
  return serviceAccounts;
}
