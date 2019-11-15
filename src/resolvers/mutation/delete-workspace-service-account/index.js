import { ResourceNotFoundError } from "errors";
import { addFragmentToInfo } from "graphql-binding";

/*
 * Delete a Workspace Service Account.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {Invite} The deleted Invite.
 */
export default async function deleteWorkspaceServiceAccount(
  parent,
  args,
  ctx,
  info
) {
  // Pull out some variables.
  const { serviceAccountUuid } = args;

  // Look for the service account.
  const serviceAccount = await ctx.db.query.serviceAccount(
    {
      where: { id: serviceAccountUuid }
    },
    `{ roleBinding { workspace { id }, deployment { id } } }`
  );

  // Throw if it doesn't exist.
  if (!serviceAccount) throw new ResourceNotFoundError();

  // Delete the record from the database.
  return ctx.db.mutation.deleteServiceAccount(
    {
      where: { id: serviceAccountUuid }
    },
    addFragmentToInfo(info, `{ id }`)
  );
}
