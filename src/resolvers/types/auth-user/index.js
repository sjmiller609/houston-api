import fragment from "./fragment";
import { hasPermission } from "rbac";
import { createAuthJWT, setJWTCookie } from "jwt";
import { addFragmentToInfo } from "graphql-binding";
import { USER_STATUS_ACTIVE } from "constants";

// Grab the user object for this id.
export function user(parent, args, ctx, info) {
  return ctx.db.query.user(
    { where: { id: parent.userId } },
    addFragmentToInfo(info, fragment)
  );
}

// Generate a JWT using the user id.
export async function token(parent, args, ctx) {
  const user = await ctx.db.query.user(
    { where: { id: parent.userId } },
    `{ status }`
  );

  if (user.status != USER_STATUS_ACTIVE) {
    //  User is not active, so they can't log in
    return null;
  }

  // Create our JWT.
  const { token, payload } = createAuthJWT(parent.userId);

  // Set the cookie.
  setJWTCookie(ctx.res, token);

  // Return in the legacy format.
  return { value: token, payload };
}

// Return empty permissions currently.
export function permissions() {
  return {};
}

// Return false by default.
export function isAdmin() {
  return false;
}

/*
 * Return boolean flags indicating what the current user has access to
 * on a particular deployment.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {AuthUserCapabilities} Map of boolean capabilities.
 */
export function authUserCapabilities(parent, args, ctx) {
  const permissions = [
    {
      key: "canSysAdmin",
      value: "system.airflow.admin"
    }
  ];
  const capabilities = [];
  permissions.map(p => {
    capabilities[p.key] = hasPermission(ctx.user, p.value);
  });

  return capabilities;
}

// Export AuthUser.
export default { user, token, permissions, isAdmin, authUserCapabilities };
