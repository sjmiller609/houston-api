import { WORKSPACE_ADMIN } from "constants";

export function role(parent) {
  // Until Prisma adds DB-level defaults, or we migrate the old rows we need this here
  return parent.role || WORKSPACE_ADMIN;
}

export default { role };
