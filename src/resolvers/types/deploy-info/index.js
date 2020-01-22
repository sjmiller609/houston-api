import { generateDefaultTag } from "deployments/config";

export function next(parent) {
  return parent.next || generateDefaultTag();
}

export default { next };
