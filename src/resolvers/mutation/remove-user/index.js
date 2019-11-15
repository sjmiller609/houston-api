import { returnUserFragment, queryUserFragment } from "./fragment";
import { NoSystemAdminError } from "errors";
import { find, size } from "lodash";
import { SYSTEM_ADMIN } from "constants";

/*
 * Remove a user from platform
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 */
export default async function removeUser(parent, args, ctx) {
  // Pull out some args
  const { userUuid } = args;

  // Build the where statement
  const where = { id: userUuid };

  // Get the user we want to remove.
  const { roleBindings } = await ctx.db.query.user(
    { where },
    queryUserFragment
  );

  // Determine if this user is a SYSTEM_ADMIN.
  const isAdmin = !!find(roleBindings, ["role", SYSTEM_ADMIN]);

  // If the user is an admin, ensure that there is
  // at least one more admin in the system, otherwise throw.
  if (isAdmin) {
    const whereAdmin = { role: SYSTEM_ADMIN, user: { id_not: userUuid } };
    const otherAdminCount = size(
      await ctx.db.query.roleBindings({ where: whereAdmin })
    );
    if (otherAdminCount === 0) throw new NoSystemAdminError();
  }

  // Remove the User
  return ctx.db.mutation.deleteUser({ where }, returnUserFragment);
}
