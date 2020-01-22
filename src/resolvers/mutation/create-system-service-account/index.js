import fragment from "./fragment";
import { InvalidRoleError } from "errors";
import { addFragmentToInfo } from "graphql-binding";
import crypto from "crypto";

/*
 * Create a System service account.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {ServiceAccount} The new ServiceAccount.
 */
export default async function createSystemServiceAccount(
  parent,
  args,
  ctx,
  info
) {
  // Pull out some variables.
  const { label, category, role } = args;

  if (!role.startsWith("SYSTEM")) throw new InvalidRoleError();
  // Create the base mutation.
  const mutation = {
    data: {
      label,
      category,
      apiKey: crypto.randomBytes(16).toString("hex"),
      active: true,
      roleBinding: {
        create: {
          role
        }
      }
    }
  };

  // Run the mutation.
  return ctx.db.mutation.createServiceAccount(
    mutation,
    addFragmentToInfo(info, fragment)
  );
}
