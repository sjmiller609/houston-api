import { prisma } from "generated/client";
import { DuplicateDeploymentLabelError } from "errors";
import { head, get } from "lodash";

/*
 * Check if this label exists for this workspace.
 * Houston 1 relied on a multi-column unique index, which prisma does not currently support.
 * This is the workaround for now. Issues for this are opened here:
 * https://github.com/prisma/prisma/issues/171
 * https://github.com/prisma/prisma/issues/1300
 */
export default async function validateExistence(
  workspaceId,
  label,
  deploymentId
) {
  // Query for deployments using label and workspaceId
  const deployments = await prisma
    .deployments({
      where: { label, workspace: { id: workspaceId }, deletedAt: null }
    })
    .id();

  // Get first.
  const deployment = head(deployments);

  // If we didn't find a deployment, just return early.
  if (!deployment) return;

  // Throw error if one already exists. (Creation)
  if (!deploymentId && deployment) {
    throw new DuplicateDeploymentLabelError(label);
  }

  // Throw error if one already exists. (Update)
  if (get(deployment, "id") !== deploymentId) {
    throw new DuplicateDeploymentLabelError(label);
  }
}
