import fragment from "./fragment";
import { addFragmentToInfo } from "graphql-binding";

/*
 * Get list of users.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {[]Deployment} List of Deployments.
 */
export default async function users(parent, args, ctx, info) {
  // Build the users query.
  const query = usersQuery(args, ctx);

  // Run final query
  return await ctx.db.query.users(query, addFragmentToInfo(info, fragment));
}

/*
 * Build the users query based on args.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {Object} The users query.
 */
export function usersQuery(args) {
  // Pull out some args.
  const { userUuid: id, username, email: address } = args;

  // If we have userUuid, use it.
  if (id) return { where: { id } };

  // If we have workspaceUuid, user it.
  if (username) return { where: { username_contains: username } };

  // If we have an email use it.
  if (address) {
    return {
      where: { emails_some: { address: address.toLowerCase() } }
    };
  }

  return null;
}
