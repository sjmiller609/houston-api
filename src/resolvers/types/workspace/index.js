import { userFragment, workspaceFragment } from "./fragment";
import { hasPermission } from "rbac";
import config from "config";
import { addFragmentToInfo } from "graphql-binding";
import { size } from "lodash";
import moment from "moment";
import { ENTITY_WORKSPACE } from "constants";

export function users(parent, args, ctx, info) {
  return ctx.db.query.users(
    {
      where: {
        roleBindings_some: {
          workspace: { id: parent.id }
        }
      }
    },
    info ? addFragmentToInfo(info, userFragment) : info
  );
}

export function invites(parent, args, ctx) {
  return ctx.db.query.inviteTokens({
    where: { workspace: { id: parent.id } }
  });
}

export function deploymentCount(parent) {
  return size(parent.deployments);
}

/*
 * Return boolean flags indicating what the current user has access to
 * on a particular workspace.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {WorkspaceCapabilities} Map of boolean capabilities.
 */
export function workspaceCapabilities(parent, args, ctx) {
  // Check to see if user has permission to view and update billing
  const canUpdateBilling = hasPermission(
    ctx.user,
    "workspace.billing.update",
    ENTITY_WORKSPACE.toLowerCase(),
    parent.id
  );

  // Check to see if user has permission to update roles
  const canUpdateIAM = hasPermission(
    ctx.user,
    "workspace.iam.update",
    ENTITY_WORKSPACE.toLowerCase(),
    parent.id
  );

  return { canUpdateIAM, canUpdateBilling };
}

// Check the config to see if stripe is enabled (Cloud mode)
export function billingEnabled() {
  const billingEnabled = config.get("stripe.enabled");
  return billingEnabled;
}

// Function to determine if the user should be blocked from viewing their workspace
export async function paywallEnabled(parent, args, ctx) {
  // Check for hard override of trial paywall logic and throw paywall
  const workspace = await ctx.db.query.workspace(
    { where: { id: parent.id } },
    workspaceFragment
  );

  const now = new Date();

  const isTrialing = moment(workspace.trialEndsAt).isAfter(now);

  const paywallEnabled = workspace.isSuspended
    ? true
    : !isTrialing && workspace.stripeCustomerId == null;

  return paywallEnabled;
}

export default {
  users,
  invites,
  deploymentCount,
  workspaceCapabilities,
  billingEnabled,
  paywallEnabled
};
