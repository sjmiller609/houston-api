import fragment from "./fragment";
import { addFragmentToInfo } from "graphql-binding";

/*
 * Get a list of workspace service accounts
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {AuthConfig} The auth config.
 */
export default async function workspaceServiceAccounts(
  parent,
  args,
  ctx,
  info
) {
  // Pull out some args.
  const { workspaceUuid } = args;

  // Build query structure.
  const query = {
    where: {
      roleBinding: {
        workspace: { id: workspaceUuid }
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
