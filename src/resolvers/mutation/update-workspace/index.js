import fragment from "./fragment";
import { pick } from "lodash";
import { addFragmentToInfo } from "graphql-binding";
/*
 * Update a Workspace.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {User} The updated User.
 */
export default function updateWorkspace(parent, args, ctx, info) {
  // The external facing schema is too loose as JSON.
  // For now, we just pluck out any props that are not in this list.
  const data = pick(args.payload, ["label", "description"]);
  const where = { id: args.workspaceUuid };
  return ctx.db.mutation.updateWorkspace(
    { where, data },
    addFragmentToInfo(info, fragment)
  );
}
