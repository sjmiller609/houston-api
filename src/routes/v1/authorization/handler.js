import { hasPermission } from "rbac";
import { prisma } from "generated/client";
import log from "logger";
import { createJWT } from "jwt";
import config from "config";
import { ENTITY_DEPLOYMENT } from "constants";
import url from "url";

/*
 * Handle authorization requests from the NGINX ingress controller.
 * @param {Object} req The request.
 * @param {Object} res The response.
 */
export default async function(req, res) {
  const { user } = req.session;
  if (!user) return res.sendStatus(401);

  // Parse out some variables.
  const originalUrl = req.get("x-original-url");
  const { hostname } = url.parse(originalUrl);
  const [subdomain] = hostname.split(".");

  // If we're accessing a monitoring service and we have permission, allow it.
  const monitoringSubdomain = /^(grafana|kibana)$/.test(subdomain);
  if (monitoringSubdomain && hasPermission(user, "system.monitoring.get")) {
    log.info(`Authorizing request to ${originalUrl}`);
    return res.sendStatus(200);
  }

  // Check if we're accessing a deployment level service.
  const matches = subdomain.match(/^([\w]+-[\w]+-[\d]+)-(airflow|flower)$/);
  if (matches) {
    // Get the deploymentId for the parsed releaseName.
    const deploymentId = await prisma
      .deployment({ deletedAt: null, releaseName: matches[1] })
      .id();

    // Check if we have deployment level access to it.
    const airflowRoles = mapLocalRolesToAirflow(user, deploymentId);

    // If we have permission, authorize it.
    if (airflowRoles.length > 0) {
      const jwt = exports.airflowJWT(user, airflowRoles, hostname);
      res.set("Authorization", "Bearer " + jwt);
      return res.sendStatus(200);
    }
    log.info(`Denying request to ${originalUrl}`);
    return res.sendStatus(403);
  }

  // If we made it this far, deny the request.
  log.info(`Denying request to ${originalUrl}`);
  return res.sendStatus(401);
}

export function airflowJWT(user, roles, hostname) {
  let email, name;
  if (user.username) {
    email = user.username.toLowerCase();
    name = user.fullName;
  } else if (user.label) {
    // A ServiceAccount
    //
    const baseDomain = config.get("helm.baseDomain");
    email = `${user.id}@service-accounts.${baseDomain}`;
    name = `Service Account: ${user.label}`;
  } else {
    throw new Error(
      "airflowJWT given something other than User or ServiceAccount"
    );
  }
  const token = createJWT({
    // Make sure that we can't use tokens from one deployment against
    // another somehow.
    aud: hostname,
    sub: user.id,
    roles: roles,
    email: email,
    full_name: name
  });
  return token;
}

export function mapLocalRolesToAirflow(user, deploymentId) {
  const entityType = ENTITY_DEPLOYMENT.toLowerCase();
  if (
    hasPermission(user, "deployment.airflow.admin", entityType, deploymentId) ||
    hasPermission(user, "system.airflow.admin")
  )
    return ["Admin"];
  if (
    hasPermission(user, "deployment.airflow.op", entityType, deploymentId) ||
    hasPermission(user, "system.airflow.op")
  )
    return ["Op"];
  if (
    hasPermission(user, "deployment.airflow.user", entityType, deploymentId) ||
    hasPermission(user, "system.airflow.user")
  )
    return ["User"];
  if (
    hasPermission(user, "deployment.airflow.get", entityType, deploymentId) ||
    hasPermission(user, "system.airflow.get")
  )
    return ["Viewer"];

  return [];
}
