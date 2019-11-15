import { get } from "lodash";
import { ENTITY_DEPLOYMENT, ENTITY_WORKSPACE } from "constants";

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

export default { entityUuid, entityType };
