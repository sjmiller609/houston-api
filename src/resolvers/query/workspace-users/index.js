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
  return ctx.db.query.users(
    {
      where: {
        roleBindings_some: {
          workspace: { id: args.workspaceUuid }
        }
      }
    },
    addFragmentToInfo(info, userFragment)
  );
}
