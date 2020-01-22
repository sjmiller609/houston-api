import { userFragment } from "./fragment";
import { addFragmentToInfo } from "graphql-binding";
/*
 * Get list of users.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return users on this specific workspace
 */
export default async function workspaceUsers(parent, args, ctx, info) {
  // Build the users query.
  const query = usersQuery(args);
  return ctx.db.query.users(query, addFragmentToInfo(info, userFragment));
}

/*
 * Build the workspaceUsers query based on args.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {Object} The users query.
 */
export function usersQuery(args) {
  // Pull out some args.
  const { fullName, email, workspaceUuid } = args;

  // Init query
  let query = {
    where: {
      AND: [
        {
          roleBindings_some: {
            workspace: { id: workspaceUuid }
          }
        }
      ]
    }
  };

  // Init OR array
  let or = [];

  // If fullName, use it.
  if (fullName) or.push({ fullName_contains: fullName });

  // If email, use it
  if (email) {
    or.push({ emails_some: { address: email.toLowerCase() } });
    or.push({ username_contains: email.toLowerCase() });
  }

  // Add OR array to query (breaks query if empty)
  if (or.length > 0) query.where.OR = or;

  return query;
}
