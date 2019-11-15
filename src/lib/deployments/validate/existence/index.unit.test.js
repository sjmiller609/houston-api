import validateExistence from "./index";
import { DuplicateDeploymentLabelError } from "errors";
import * as exports from "generated/client";
import casual from "casual";

describe("validateExistence", () => {
  test("throws error if duplicate named deployment exists in workspace", async () => {
    const workspaceId = casual.uuid;
    const label = casual.word;

    const deployments = function() {
      return {
        id: () => [{ id: casual.uuid }]
      };
    };

    // Set up our spy.
    jest.spyOn(exports.prisma, "deployments").mockImplementation(deployments);

    // Call the function.
    await expect(validateExistence(workspaceId, label)).rejects.toThrow(
      new DuplicateDeploymentLabelError(label)
    );
    expect(exports.prisma.deployments).toBeCalledWith({
      where: { deletedAt: null, label, workspace: { id: workspaceId } }
    });
  });

  test("does not throw error if updating current deployment", async () => {
    const workspaceId = casual.uuid;
    const label = casual.word;
    const deploymentId = casual.uuid;

    const deployments = function() {
      return {
        id: () => [{ id: deploymentId }]
      };
    };

    // Set up our spy.
    jest.spyOn(exports.prisma, "deployments").mockImplementation(deployments);

    // Call the function.
    await expect(
      validateExistence(workspaceId, label, deploymentId)
    ).resolves.not.toThrow();
    expect(exports.prisma.deployments).toBeCalledWith({
      where: { deletedAt: null, label, workspace: { id: workspaceId } }
    });
  });

  test("throws error if different deployment in workspace has label", async () => {
    const workspaceId = casual.uuid;
    const label = casual.word;
    const deploymentId = casual.uuid;

    const deployments = function() {
      return {
        id: () => [{ id: casual.uuid }]
      };
    };

    // Set up our spy.
    jest.spyOn(exports.prisma, "deployments").mockImplementation(deployments);

    // Call the function.
    await expect(
      validateExistence(workspaceId, label, deploymentId)
    ).rejects.toThrow(new DuplicateDeploymentLabelError(label));
    expect(exports.prisma.deployments).toBeCalledWith({
      where: { deletedAt: null, label, workspace: { id: workspaceId } }
    });
  });

  test("does not throw an error if no deployment found", async () => {
    const workspaceId = casual.uuid;
    const label = casual.word;
    const deploymentId = casual.uuid;

    const deployments = function() {
      return {
        id: () => []
      };
    };

    // Set up our spy.
    jest.spyOn(exports.prisma, "deployments").mockImplementation(deployments);

    // Call the function.
    await expect(
      validateExistence(workspaceId, label, deploymentId)
    ).resolves.not.toThrow();
    expect(exports.prisma.deployments).toBeCalledWith({
      where: { deletedAt: null, label, workspace: { id: workspaceId } }
    });
  });
});
