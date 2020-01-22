import userFragment from "./user-fragment";
import serviceAccountFragment from "./service-account-fragment";
import deploymentFragment from "./deployment-fragment";
import { decodeJWT } from "jwt";
import { PermissionError } from "errors";
import { prisma } from "generated/client";
import {
  constant,
  filter,
  find,
  fromPairs,
  get,
  includes,
  isArray,
  map,
  size,
  times,
  zip
} from "lodash";
import config from "config";
import { ENTITY_DEPLOYMENT, ENTITY_WORKSPACE } from "constants";

// The config module doesn't let us edit the config at runtime, so we can't set
// this back in place.
export const ROLES = upgradeOldRolesConfig(config.get("roles"));

/*
 * Check if the user has the given permission for the entity.
 * @param {Object} user The current user.
 * @param {String} permission The required permission.
 */
export function hasPermission(user, permission, entityType, entityId) {
  // If user is falsy, immediately fail.
  if (!user) return false;

  // Check if we're looking for a global permission.
  const systemPermission = permission.startsWith("system");

  // If we're looking for a system permission, return if user has it.
  if (systemPermission) return hasSystemPermission(user, permission);

  // If we don't have both of these, return false from here.
  if (!entityType || !entityId) return false;

  // Otherwise we have to ensure the user has access to the entity.
  const binding = find(user.roleBindings, binding => {
    // Return true if we're looking for a scoped permission,
    // and this binding has the entity type we're interested
    // in and the id matches.
    const hasEntity = !!binding[entityType];
    return hasEntity && binding[entityType].id === entityId;
  });

  // If we didn't find a roleBinding, return false.
  if (!binding) return false;

  // Otherwise return if this role has an appropriate permission.
  const role = get(ROLES, binding.role, { permissions: [] });

  return get(role.permissions, permission, false) !== false;
}

/*
 * Check if the user has a system permission.
 * @param {Object} user The current user.
 * @param {String} user The desired permission.
 * @param {Boolean} If the user has the system permission.
 */
export function hasSystemPermission(user, permission) {
  if (!user) return false;

  for (const binding of user.roleBindings) {
    const role = ROLES[binding.role];
    if (!role) continue;

    if (get(role.permissions, permission, false) !== false) {
      return true;
    }
  }
  return false;
}

/*
 * Check if the user has the given permission for the entity.
 * Throws if the user does not have permission.
 * @param {Object} user The current user.
 * @param {String} permission The required permission.
 */
export function checkPermission(user, permission, entityType, entityId) {
  if (!hasPermission(user, permission, entityType, entityId)) {
    throw new PermissionError();
  }
}

/*
 * Check if the user has the given permission for the entity.
 * Throws if the user does not have permission.
 * @param {Object} user The current user.
 * @param {String} permission The required permission.
 */
export function checkSystemPermission(user, permission) {
  if (!hasSystemPermission(user, permission)) {
    throw new PermissionError();
  }
}

/* Get a user that has the required information to make
 * RBAC decisions.
 * @param {String} id The user id.
 * @return {Object} The User object with RoleBindings.
 */
export async function getUserWithRoleBindings(id) {
  return await prisma.user({ id }).$fragment(userFragment);
}

/* Get a ServiceAccount that has the required information to make
 * RBAC decisions.
 * @param {String} apiKey The apiKey.
 * @return {Object} The ServiceAccount object with RoleBindings.
 */
export async function getServiceAccountWithRoleBindings(apiKey) {
  // Get the Service Account by API Key.
  const serviceAccount = await prisma
    .serviceAccount({ apiKey })
    .$fragment(serviceAccountFragment);

  // Return early if we didn't find a service account.
  if (!serviceAccount) return;

  // Return a slightly modified version, to mimic what we return
  // for a user.
  serviceAccount.roleBindings = [serviceAccount.roleBinding];
  delete serviceAccount.roleBinding;
  return serviceAccount;
}

/*
 * Check if the authorization header looks like a service account.
 * @param {String} authorization An authorization header.
 * @return {Boolean} If the header looks like a service account
 */
export function isServiceAccount(authorization) {
  return size(authorization) === 32 && !includes(authorization, ".");
}

/*
 * Get either a user or a Service Account from an Authorization header.
 * @param {String} authorization An authorization header.
 * @return {Object} The authed user or Service Account.
 */
export async function getAuthUser(authorization) {
  // Return early if empty.
  if (!authorization) return;

  // Check if the header is a service account.
  const isServiceAcct = isServiceAccount(authorization);

  // If we do have a service account, set it as the user on the context.
  if (isServiceAcct) {
    return await addSyntheticRoleBindings(
      await getServiceAccountWithRoleBindings(authorization)
    );
  }

  // Decode the JWT.
  const { uuid } = await decodeJWT(authorization);

  // If we have a userId, set the user on the session,
  // otherwise return nothing.
  if (uuid) {
    return await addSyntheticRoleBindings(await getUserWithRoleBindings(uuid));
  }
}

/*
 * TODO: Remove me and the two references to me right above when
 * deployment level RBAC is in place.
 * This function wraps the two calls above to append fake roleBindings
 * to the user object for any deployments that belong to workspaces.
 * @param {Object} User A user or service account.
 * @return {Object} The user object with roleBindings.
 */
async function addDeploymentRoleBindings(user) {
  if (!user) return;

  // Get list of roleBindings for all workspaces the user belongs to.
  const workspaceRoleBindings = filter(user.roleBindings, rb =>
    rb.role.startsWith(ENTITY_WORKSPACE)
  );

  // Pull out the workspace ids.
  const workspaceIds = map(workspaceRoleBindings, "workspace.id");

  // Get the deployments that are under any of our workspaces.
  const deployments = await prisma
    .deployments({
      where: { workspace: { id_in: workspaceIds }, deletedAt: null }
    })
    .$fragment(deploymentFragment);

  // Generate fake rolebindings for deployment level admin.
  const deploymentRoleBindings = map(deployments, deployment => {
    // Get the roleBinding for the workspace this deployment belongs to.
    const rb = find(
      workspaceRoleBindings,
      rb => rb.workspace.id === deployment.workspace.id
    );

    // Replace the WORKSPACE_* role with DEPLOYMENT_*.
    const role = rb.role.replace(ENTITY_WORKSPACE, ENTITY_DEPLOYMENT);

    // Return the new DEPLOYMENT_* roleBinding.
    return {
      role,
      workspace: null,
      deployment: { id: deployment.id }
    };
  });

  // Combine with existing real roleBindings.
  const roleBindings = [...user.roleBindings, ...deploymentRoleBindings];

  // Return a modified user, spreading existing rolebindings, with new fake ones.
  return { ...user, roleBindings };
}

/* Bind the USER role to all users on the platform.
 * This role will allow anyone to create a new workspace,
 * but it gives us an extra layer of configuration in our permissions.
 * Enterprise customers can use this role to determine what default permissions
 * all platform users have.
 * @param {Object} User A user or service account.
 * @return {Object} The user object with roleBindings.
 */
export function addUserRoleBinding(user) {
  if (!user) return;

  const userRoleBinding = { role: "USER", workspace: null, deployment: null };

  // Combine with existing real roleBindings.
  const roleBindings = [...user.roleBindings, userRoleBinding];

  // Return a modified user, spreading existing rolebindings, with new fake ones.
  return { ...user, roleBindings };
}

/* Add any "synthetic" roles to the user object. These are any roles
 * that we want to programatically assign at runtime, rather than ones that
 * are stored in the database.
 * @param {Object} User A user or service account.
 * @return {Object} The user object with roleBindings.
 */
async function addSyntheticRoleBindings(user) {
  return addUserRoleBinding(await addDeploymentRoleBindings(user));
}

// /* If the passed argument is a string, lookup the user by id.
//  * Otherwise use the user.id to get the user, with RoleBindings.
//  * @param {String|Object} user The user object or id.
//  * @return {Promise<Object} The user object with RoleBindings.
//  */
// export function ensureUserRoleBindings(user) {
//   if (isString(user)) return getUserWithRoleBindings(user);
//   return getUserWithRoleBindings(user.id);
// }

/* Return a list of deployment ids to which the user has the requested
 * permission
 * @param {Object} user The user object
 * @return {Array} list of deploymentIds
 */
export function accesibleDeploymentsWithPermission(user, permission) {
  if (!user) return [];

  const entityType = ENTITY_DEPLOYMENT.toLowerCase();

  return filter(user.roleBindings, binding => {
    if (!binding[entityType]) return false;
    const role = ROLES[binding.role];
    if (!role) return false;
    return get(role.permissions, permission, false) !== false;
  }).map(binding => binding.deployment.id);
}

// Upgrade from the old list-of-lists to dict-of-dicts config style
export function upgradeOldRolesConfig(roles) {
  if (!isArray(roles)) return roles;

  /*
   * Input:
   * - id: SYSTEM_EDITOR
   *   name: System Editor
   *   permissions:
   *     - system.iam.update
   *
   * Output:
   * SYSTEM_EDITOR:
   *   name: System Editor
   *   permissions:
   *     system.iam.update: null
   *
   * (value as `null` so we can use the `? system.iam.update` mapping key
   * syntax of yaml <https://yaml.org/spec/1.2/spec.html#?%20mapping%20key//>)
   */

  return fromPairs(
    map(roles, role => {
      return [
        role.id,
        {
          name: role.name,
          permissions: fromPairs(
            zip(
              role.permissions,
              times(role.permissions.length, constant(null))
            )
          )
        }
      ];
    })
  );
}
