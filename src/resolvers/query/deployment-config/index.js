import {
  defaultResources,
  airflowVersions,
  airflowImages,
  defaultAirflowImage
} from "deployments/config";
import config from "config";
import { keyBy } from "lodash";

/*
 * Get details on possible deployment configurations.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {DeploymentConfig} The deployment config.
 */
export default async function deploymentConfig() {
  // Get astroUnit object directly from config.
  const astroUnit = config.get("deployments.astroUnit");

  // Get maximum extra AU directly from config.
  const maxExtraAu = config.get("deployments.maxExtraAu");

  // Generate defaults.
  const defaults = defaultResources("default", false);

  // Generate limits.
  const limits = defaultResources("limit", false);

  // Get list of executors, transform to object, keyed by name.
  const executors = keyBy(config.get("deployments.executors"), "name");

  // Get current version of platform, passed from helm.
  const latestVersion = config.get("helm.releaseVersion");

  // Are we deploying the platform and airflow into the same namespace (true),
  // or creating a new namespace for each deployment (false)
  const singleNamespace = config.get("helm.singleNamespace");

  // Is elasticsearch logging enabled. This will control orbits UI components.
  const isDev = process.env.NODE_ENV !== "production";
  const { enabled, mockInDevelopment } = config.get("elasticsearch");
  const loggingEnabled = isDev && mockInDevelopment ? true : enabled;

  // Latest airflow image tag.
  const defaultAirflowImageTag = defaultAirflowImage().tag;

  // Latest Airflow chart version.
  const defaultAirflowChartVersion = config.get("deployments.chart.version");

  return {
    defaults,
    limits,
    astroUnit,
    maxExtraAu,
    executors,
    singleNamespace,
    loggingEnabled,
    latestVersion,
    airflowImages,
    airflowVersions,
    defaultAirflowImageTag,
    defaultAirflowChartVersion
  };
}
