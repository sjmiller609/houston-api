export const deploymentFragment = `fragment EnsureFields on Deployment {
  id
  config
  releaseName
  version
  extraAu
  airflowVersion
  alertEmails
  workspace { id }
}`;

export const workspaceFragment = `{
  stripeCustomerId
  isSuspended
  deployments {id, deletedAt}
}`;
