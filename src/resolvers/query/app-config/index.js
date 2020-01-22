import config from "config";

/*
 * Get information about how app is configured for the cluster.
 */
export default async function appConfig() {
  const vars = {
    version: config.get("helm.releaseVersion"),
    baseDomain: config.get("helm.baseDomain")
  };

  return vars;
}
