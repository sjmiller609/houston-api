export const queryFragment = `fragment EnsureFields on Deployment {
  id
  config
  releaseName
  workspace {
    id
    stripeCustomerId
    isSuspended
  }
}`;

export const responseFragment = `fragment EnsureFields on Deployment {
  id
  releaseName
  workspace {
    id
  }
  version
  extraAu
  airflowVersion
  alertEmails
}`;
