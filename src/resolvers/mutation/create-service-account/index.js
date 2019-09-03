import fragment from "./fragment";
import { checkPermission } from "rbac";
import { addFragmentToInfo } from "graphql-binding";
import { UserInputError } from "apollo-server";
import crypto from "crypto";
import { ENTITY_DEPLOYMENT, ENTITY_WORKSPACE } from "constants";

/*
 * Create a service account.
 * This resolver has some abnormal behavior since it has to do
 * some extra checks that could not be handled by our auth directive.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {ServiceAccount} The new ServiceAccount.
 */
export default async function createServiceAccount(parent, args, ctx, info) {
  // Pull out some variables.
  const {
    label,
    category,
    entityType: upperEntityType,
    entityUuid,
    role
  } = args;
  const entityType = upperEntityType.toLowerCase();

  // Make sure we have permission to do this.
  checkPermission(
    ctx.user,
    `${entityType}.serviceAccounts.create`,
    entityType,
    entityUuid
  );

  // Validate the role is for the right entity type
  if (
    (role.startsWith(ENTITY_WORKSPACE) &&
      upperEntityType != ENTITY_WORKSPACE) ||
    (role.startsWith(ENTITY_DEPLOYMENT) && upperEntityType != ENTITY_DEPLOYMENT)
  ) {
    throw new UserInputError("Entity and role types don't match");
  }

  // Create the base mutation.
  const mutation = {
    data: {
      label,
      category,
      apiKey: crypto.randomBytes(16).toString("hex"),
      active: true,
      roleBinding: {
        create: {
          role,
          [entityType]: {
            connect: { id: entityUuid }
          }
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
