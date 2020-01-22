export default `fragment EnsureFields on Deployment {
  id
  config
  releaseName
  version
  extraAu
  airflowVersion
  alertEmails
  workspace {
    id
  }
}`;
