import serviceAccountFragment from "rbac/service-account-fragment";
import { addFragmentToInfo } from "graphql-binding";
import { pick } from "lodash";

/*
 * Update a Deployment Service Account.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {ServiceAccount} The updated ServiceAccount.
 */
export default async function updateDeploymentServiceAccount(
  parent,
  args,
  ctx,
  info
) {
  // The external facing schema is too loose as JSON.
  // For now, we just pluck out any props that are not in this list.
  const data = pick(args.payload, ["category", "label"]);
  const where = { id: args.serviceAccountUuid };
  const role = args.payload.role;

  // Get role bindings
  if (role) {
    const roleBindings = await ctx.db.query.roleBindings(
      { where: { serviceAccount: where } },
      "{ id }"
    );

    // Update the rolebinding if included in payload
    if (roleBindings.length > 0) {
      ctx.db.mutation.updateRoleBinding({
        where: { id: roleBindings[0].id },
        data: { role: role }
      });
    }
  }

  return ctx.db.mutation.updateServiceAccount(
    { where, data },
    addFragmentToInfo(info, serviceAccountFragment)
  );
}
