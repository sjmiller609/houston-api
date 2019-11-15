import fragment from "./fragment";
import { addFragmentToInfo } from "graphql-binding";

/*
 * Get a single workspace service account
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {AuthConfig} The auth config.
 */
export default async function workspaceServiceAccount(parent, args, ctx, info) {
  // Pull out some args.
  const { serviceAccountUuid } = args;

  // Build query structure.
  const query = { where: { id: serviceAccountUuid } };

  // Run final query
  const serviceAccount = await ctx.db.query.serviceAccount(
    query,
    addFragmentToInfo(info, fragment)
  );

  // If we made it here, return the service account.
  return serviceAccount;
}
