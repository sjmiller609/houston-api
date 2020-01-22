import * as userExports from "./index";
import { sendEmail } from "emails";
import * as prismaExports from "generated/client";
import {
  InviteTokenNotFoundError,
  InviteTokenEmailError,
  PublicSignupsDisabledError
} from "errors";
import config from "config";
import casual from "casual";
import {
  USER_STATUS_PENDING,
  USER_STATUS_ACTIVE,
  WORKSPACE_EDITOR,
  WORKSPACE_VIEWER
} from "constants";

jest.mock("emails");

describe("userExports.createUser", () => {
  const usersConnection = () => {
    return {
      aggregate() {
        return { count: () => 1 };
      }
    };
  };

  jest
    .spyOn(prismaExports.prisma, "usersConnection")
    .mockImplementation(usersConnection);

  const prismaCreateUser = jest
    .spyOn(prismaExports.prisma, "createUser")
    .mockImplementation(() => {
      return { id: () => 1 };
    });

  const opts = {
    user: casual.username,
    email: casual.email
  };

  beforeEach(() => {
    config.publicSignups = true;
  });

  test("throws error if not the first signup and public signups disabled", async () => {
    config.publicSignups = false;
    await expect(userExports.createUser(opts)).rejects.toThrow(
      new PublicSignupsDisabledError()
    );
    expect(prismaCreateUser).not.toHaveBeenCalled();
  });

  test("creates an pending user by default", async () => {
    const opts = {
      user: casual.username,
      email: casual.email
    };

    expect(await userExports.createUser(opts)).toBe(1);
    expect(prismaCreateUser.mock.calls[0][0]).toHaveProperty(
      "status",
      USER_STATUS_PENDING
    );
    expect(prismaCreateUser.mock.calls[0][0]).toHaveProperty(
      "emails.create.verified",
      false
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(opts.email, "confirm-email", {
      token: expect.any(String),
      orbitUrl: "http://app.astronomer.io:5000",
      strict: true
    });
  });

  test("creates an active user on request", async () => {
    // I.e. for oauth user signup flow.
    let activeOpts = { ...opts, active: true };

    expect(await userExports.createUser(activeOpts)).toBe(1);
    expect(prismaCreateUser.mock.calls[0][0]).toHaveProperty(
      "status",
      USER_STATUS_ACTIVE
    );
    expect(prismaCreateUser.mock.calls[0][0]).toHaveProperty(
      "emails.create.verified",
      false
    );
  });

  describe("when given a valid inviteToken", () => {
    beforeEach(() => {
      jest
        .spyOn(prismaExports.prisma, "deleteManyInviteTokens")
        .mockReturnValue(true);
    });
    test("creates an active user", async () => {
      const invite = casual.uuid;
      const invite2 = casual.uuid;
      const workspace = casual.uuid;
      const workspace2 = casual.uuid;
      const mockValidateInvite = jest
        .spyOn(userExports, "validateInviteToken")
        .mockImplementation(() => [
          {
            id: invite,
            workspace: { id: workspace },
            role: WORKSPACE_EDITOR
          },
          {
            id: invite2,
            workspace: { id: workspace2 },
            role: WORKSPACE_VIEWER
          }
        ]);

      const opts = {
        user: casual.username,
        email: casual.email,
        inviteToken: invite
      };

      expect(await userExports.createUser(opts)).toBe(1);
      expect(sendEmail).not.toHaveBeenCalled();
      expect(prismaExports.prisma.deleteManyInviteTokens).toHaveBeenCalledWith({
        id_in: [invite, invite2]
      });

      const createData = prismaCreateUser.mock.calls[0][0];
      expect(createData).toHaveProperty("status", USER_STATUS_ACTIVE);
      expect(createData).toHaveProperty("emails.create.verified", true);
      expect(createData).toHaveProperty("roleBindings.create");
      const roleBindings = createData.roleBindings.create;
      expect(roleBindings).toHaveLength(2);
      expect(roleBindings[0]).toHaveProperty("workspace.connect.id", workspace);
      expect(roleBindings[0]).toHaveProperty("role", WORKSPACE_EDITOR);
      expect(roleBindings[1]).toHaveProperty(
        "workspace.connect.id",
        workspace2
      );
      expect(roleBindings[1]).toHaveProperty("role", WORKSPACE_VIEWER);

      mockValidateInvite.mockRestore();
    });
  });
});

describe("userExports.validateInviteToken", () => {
  // Set by each test case
  let inviteRecords;
  jest.spyOn(prismaExports.prisma, "inviteToken").mockReturnValue({
    email: () => (inviteRecords[0] ? inviteRecords[0].email : null)
  });
  jest
    .spyOn(prismaExports.prisma, "inviteTokens")
    .mockReturnValue({ $fragment: () => inviteRecords });

  beforeEach(() => (inviteRecords = []));

  test("return nothing if nothing passed", async () => {
    const res = await userExports.validateInviteToken(undefined, casual.email);
    expect(res).toHaveLength(0);
  });

  test("throws if token is not found", async () => {
    await expect(
      userExports.validateInviteToken(casual.word, casual.email)
    ).rejects.toThrow(new InviteTokenNotFoundError());
  });

  test("throws if email does not match token email", async () => {
    inviteRecords = [{ email: casual.email }];
    await expect(
      userExports.validateInviteToken(casual.word, casual.email)
    ).rejects.toThrow(new InviteTokenEmailError());
  });

  test("returns all tokens when token found and email matches", async () => {
    // Casual generates emails in TitleCase, be we store them in lowercase from
    // the inviteUser mutation.
    const email = casual.email.toLowerCase();
    inviteRecords = [{ email: email }];

    await expect(
      userExports.validateInviteToken(casual.word, email.toUpperCase())
    ).resolves.toStrictEqual(inviteRecords);
  });
});

describe("userExports.defaultWorkspaceLabel", () => {
  test("generates workspace label with full name", () => {
    const opts = { fullName: "Elon Musk", username: "elon1" };
    const res = userExports.defaultWorkspaceLabel(opts);
    expect(res).toBe("Elon Musk's Workspace");
  });

  test("generates workspace label with username", () => {
    const opts = { username: "elon1" };
    const res = userExports.defaultWorkspaceLabel(opts);
    expect(res).toBe("elon1's Workspace");
  });

  test("generates workspace label no user information", () => {
    const opts = {};
    const res = userExports.defaultWorkspaceLabel(opts);
    expect(res).toBe("Default Workspace");
  });
});

describe("userExports.defaultWorkspaceDescription", () => {
  test("generates workspace description with full name", () => {
    const opts = { fullName: "Elon Musk", username: "elon1" };
    const res = userExports.defaultWorkspaceDescription(opts);
    expect(res).toBe("Default workspace for Elon Musk");
  });

  test("generates workspace description with email", () => {
    const opts = { username: "elon1" };
    const res = userExports.defaultWorkspaceDescription(opts);
    expect(res).toBe("Default workspace for elon1");
  });

  test("generates workspace description with username", () => {
    const opts = { email: "elon1@gmail.com" };
    const res = userExports.defaultWorkspaceDescription(opts);
    expect(res).toBe("Default workspace for elon1@gmail.com");
  });

  test("generates workspace description no user information", () => {
    const opts = {};
    const res = userExports.defaultWorkspaceDescription(opts);
    expect(res).toBe("Default Workspace");
  });
});
