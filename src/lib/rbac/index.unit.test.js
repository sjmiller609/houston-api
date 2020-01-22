import {
  hasPermission,
  hasSystemPermission,
  checkPermission,
  isServiceAccount,
  accesibleDeploymentsWithPermission,
  upgradeOldRolesConfig,
  addUserRoleBinding
} from "./index";
import casual from "casual";
import {
  DEPLOYMENT_ADMIN,
  DEPLOYMENT_VIEWER,
  ENTITY_WORKSPACE,
  WORKSPACE_ADMIN
} from "constants";

describe("hasPermission", () => {
  test("permits user with matching entity id", () => {
    const workspaceId = casual.uuid;

    const user = {
      id: casual.uuid,
      roleBindings: [
        { role: "WORKSPACE_ADMIN", workspace: { id: workspaceId } }
      ]
    };

    const hasPerm = hasPermission(
      user,
      "workspace.deployments.get",
      ENTITY_WORKSPACE.toLowerCase(),
      workspaceId
    );

    expect(hasPerm).toBe(true);
  });

  test("denies an undefined user", () => {
    const workspaceId = casual.uuid;
    const user = null;

    const hasPerm = hasPermission(
      user,
      "workspace.deployments.get",
      ENTITY_WORKSPACE.toLowerCase(),
      workspaceId
    );

    expect(hasPerm).toBe(false);
  });

  test("denies user without matching entity id", () => {
    const user = {
      id: casual.uuid,
      roleBindings: [
        { role: "WORKSPACE_ADMIN", workspace: { id: casual.uuid } }
      ]
    };

    const hasPerm = hasPermission(
      user,
      "workspace.deployments.get",
      ENTITY_WORKSPACE.toLowerCase(),
      casual.uuid
    );

    expect(hasPerm).toBe(false);
  });

  test("denies user without matching permission", () => {
    const workspaceId = casual.uuid;

    const user = {
      id: casual.uuid,
      roleBindings: [
        { role: "WORKSPACE_ADMIN", workspace: { id: workspaceId } }
      ]
    };

    const hasPerm = hasPermission(
      user,
      "some.other.permission",
      ENTITY_WORKSPACE.toLowerCase(),
      workspaceId
    );

    expect(hasPerm).toBe(false);
  });

  test("denies when config sets permission to false", () => {
    const user = {
      id: casual.uuid,
      roleBindings: [{ role: "SYSTEM_VIEWER" }]
    };

    const hasPerm = hasPermission(user, "system.monitoring.get");

    expect(hasPerm).toBe(false);
  });
});

describe("hasSystemPermission", () => {
  test("permits user with matching system permission", () => {
    const user = {
      id: casual.uuid,
      roleBindings: [{ role: "SYSTEM_ADMIN" }]
    };

    const hasPerm = hasSystemPermission(user, "system.monitoring.get");
    expect(hasPerm).toBe(true);
  });

  test("denies user with matching missing permission", () => {
    const user = {
      id: casual.uuid,
      roleBindings: [{ role: "WORKSPACE_ADMIN" }]
    };

    const hasPerm = hasSystemPermission(user, "system.monitoring.get");
    expect(hasPerm).toBe(false);
  });
});

describe("checkPermission", () => {
  test("throws if user does not have permission", () => {
    const user = {
      id: casual.uuid,
      roleBindings: [{ role: "WORKSPACE_ADMIN" }]
    };

    expect(() => {
      checkPermission(user, "system.monitoring.get");
    }).toThrow();
  });
});

describe("isServiceAccount", () => {
  test("returns true for a valid service account", () => {
    const header = "abcdefghijklmnopqrstuvwxyz012345";
    const isServiceAcct = isServiceAccount(header);
    expect(isServiceAcct).toBe(true);
  });

  test("returns false for an invalid length", () => {
    const header = "abcdefghijklmnop";
    const isServiceAcct = isServiceAccount(header);
    expect(isServiceAcct).toBe(false);
  });

  test("returns false for a header with dots in it (jwt)", () => {
    const header =
      "abcdefghijklmnopqrstuvwxyz012345.abcdefghijklmnopqrstuvwxyz012345.abcdefghijklmnopqrstuvwxyz012345";
    const isServiceAcct = isServiceAccount(header);
    expect(isServiceAcct).toBe(false);
  });
});

describe("accesibleDeploymentsWithPermission", () => {
  // For this test we want our user to have access to more than one
  // namespace, some at push and some at pull.
  const userObject = {
    id: casual.uuid,
    roleBindings: [
      { role: DEPLOYMENT_ADMIN, deployment: { id: "deployment1" } },
      { role: DEPLOYMENT_VIEWER, deployment: { id: "deployment2" } },
      { role: WORKSPACE_ADMIN, workspace: { id: "workspace3" } },
      { role: DEPLOYMENT_ADMIN, deployment: { id: "deployment4" } }
    ]
  };

  test("No user has nothing accessible", () => {});
  expect(accesibleDeploymentsWithPermission(null, "deployment.x")).toHaveLength(
    0
  );

  test("respects permissions", () => {
    const deployments = accesibleDeploymentsWithPermission(
      userObject,
      "deployment.images.push"
    );
    expect(deployments).toEqual([
      userObject.roleBindings[0].deployment.id,
      userObject.roleBindings[3].deployment.id
    ]);
  });
});

describe("upgradeOldRolesConfig", () => {
  const newConfig = {
    ROLE_NAME: {
      name: "x",
      permissions: {
        perm1: null,
        perm2: null
      }
    }
  };
  test("upgrades old conifg", () => {
    const oldConfig = [
      {
        id: "ROLE_NAME",
        name: "x",
        permissions: ["perm1", "perm2"]
      }
    ];
    expect(upgradeOldRolesConfig(oldConfig)).toEqual(newConfig);
  });

  test("leaves new conifg alone", () => {
    expect(upgradeOldRolesConfig(newConfig)).toBe(newConfig);
  });
});

describe("addUserRoleBinding", () => {
  const userId = casual.uuid;
  const newUser = {
    id: userId,
    roleBindings: [
      {
        role: "USER",
        workspace: null,
        deployment: null
      }
    ]
  };
  test("passing no user returns undefined", () => {
    const user = null;
    expect(addUserRoleBinding(user)).toBeUndefined();
  });
  test("returns with USER role", () => {
    const user = {
      id: userId,
      roleBindings: []
    };
    expect(addUserRoleBinding(user)).toEqual(newUser);
  });
});
