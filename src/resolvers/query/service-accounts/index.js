import fragment from "./fragment";
import { hasPermission } from "rbac";
import { PermissionError, MissingArgumentError } from "errors";
import { compact, includes } from "lodash";
import { addFragmentToInfo } from "graphql-binding";

/*
 * Get a list of service accounts.
 * XXX: Available for backwards compatibility - please use the scoped
 * mutations and queries moving forward.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {AuthConfig} The auth config.
 */
export default async function serviceAccounts(parent, args, ctx, info) {
  // Pull out some args.
  const { serviceAccountUuid, entityType: upperEntityType, entityUuid } = args;
  const entityType = upperEntityType.toLowerCase();

  // Unfortunately not captured in schema, but throw error if we are missing
  // a required argument.
  if (!(serviceAccountUuid || entityUuid)) {
    throw new MissingArgumentError("serviceAccountUuid or entityUuid");
  }

  // Get a list of ids of entityType that this user has access to.
  const ids = compact(
    ctx.user.roleBindings.map(binding =>
      binding[entityType] ? binding[entityType].id : null
    )
  );

  // Build query structure.
  const query = { where: { AND: [] } };

  // Check if we have system-level access.
  const hasSystemPerm = hasPermission(ctx.user, "system.serviceAccounts.get");

  // If we have service account id, add to filter.
  if (serviceAccountUuid) {
    query.where.AND.push({
      id: serviceAccountUuid
    });
  }

  // If we do not have system-level access, limit query to only ids user can access.
  if (!hasSystemPerm) {
    query.where.AND.push({
      roleBinding: {
        [entityType]: { id_in: ids }
      }
    });
  }

  // Throw an error if the entityUuid is not in the list of ids.
  if (!hasSystemPerm && entityUuid && !includes(ids, entityUuid)) {
    throw new PermissionError();
  }

  // If we have entityUuid, add to filter.
  if (entityUuid) {
    query.where.AND.push({
      roleBinding: {
        [entityType]: { id: entityUuid }
      }
    });
  }

  // Run final query
  const serviceAccounts = await ctx.db.query.serviceAccounts(
    query,
    addFragmentToInfo(info, fragment)
  );

  // If we made it here, return the service accounts.
  return serviceAccounts;
}
