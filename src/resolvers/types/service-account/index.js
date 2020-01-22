import { get, padEnd } from "lodash";
import config from "config";
import moment from "moment";
import { ENTITY_DEPLOYMENT, ENTITY_WORKSPACE } from "constants";

export function apiKey({ apiKey, createdAt }) {
  const { showFor, showFirstChars } = config.get("serviceAccounts");
  const expirationDate = moment(createdAt).add(showFor, "minutes");
  return moment().diff(expirationDate) < 0
    ? apiKey
    : padEnd(apiKey.substr(0, showFirstChars), apiKey.length, "*");
}

export function entityUuid(parent) {
  return (
    get(parent, "roleBinding.workspace.id") ||
    get(parent, "roleBinding.deployment.id")
  );
}

export function entityType(parent) {
  return get(parent, "roleBinding.workspace.id")
    ? ENTITY_WORKSPACE
    : ENTITY_DEPLOYMENT;
}

export default { apiKey, entityUuid, entityType };
