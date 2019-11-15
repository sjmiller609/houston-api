import adjectives from "./adjectives";
import nouns from "./nouns";
import { objectToArrayOfKeyValue } from "deployments/config";
import config from "config";
import Haikunator from "haikunator";

/*
 * Generate a release name using the adjectives and nouns in this package.
 * @param {Integer} tokenLength Amount of digits to append.
 * @return {String} The release name.
 */
export function generateReleaseName(tokenLength = 4) {
  const haikunator = new Haikunator({ adjectives, nouns });
  return haikunator.haikunate({ tokenLength }).replace(/_/g, "-");
}

/*
 * Generate a namespace from the given release name.
 * @param {String} releaseName A release name.
 * @return {String} The namespace name
 */
export function generateNamespace(releaseName) {
  const { releaseNamespace, singleNamespace } = config.get("helm");
  return singleNamespace
    ? releaseNamespace
    : `${releaseNamespace}-${releaseName}`;
}

/*
 * Return an empty array if single namespace mode,
 * otherwise return the labels from the config file
 * @param {Object} platform Platform information {"release", "workspace"}
 * @return array of objects in the form {"key": ****, "value": ***}
 */
export function generateDeploymentLabels(platform = {}) {
  const { singleNamespace } = config.get("helm");
  const { namespaceLabels } = config.get("deployments");

  const objectOfKeys = {
    ...(singleNamespace ? {} : namespaceLabels),
    ...platform
  };

  return objectToArrayOfKeyValue(objectOfKeys);
}

/*
 * Generate the name for environment secret.
 * @param {String} releaseName A release name.
 * @return {String} The secret name.
 */
export function generateEnvironmentSecretName(releaseName) {
  return `${releaseName}-env`;
}

/*
 * Generate the database name for a release.
 * @param {String} releaseName A release name.
 * @return {String} The database name.
 */
export function generateDatabaseName(releaseName) {
  const rel = releaseName.replace(/-/g, "_");
  return `${rel}_airflow`;
}

/*
 * Generate the airflow user name for a release.
 * @param {String} releaseName A release name.
 * @return {String} The user name.
 */
export function generateAirflowUsername(releaseName) {
  const rel = releaseName.replace(/-/g, "_");
  return `${rel}_airflow`;
}

/*
 * Generate the celery user name for a release.
 * @param {String} releaseName A release name.
 * @return {String} The user name.
 */
export function generateCeleryUsername(releaseName) {
  const rel = releaseName.replace(/-/g, "_");
  return `${rel}_celery`;
}
