import resolvers from "resolvers";
import { sendEmail } from "emails";
import casual from "casual";
import { graphql } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { importSchema } from "graphql-import";

// Import our application schema
const schema = makeExecutableSchema({
  typeDefs: importSchema("src/schema.graphql"),
  resolvers
});

jest.mock("emails");

// Define our mutation
const query = `
  mutation workspaceAddUser(
    $workspaceUuid: Uuid
    $email: String!
  ) {
    workspaceAddUser(
      workspaceUuid: $workspaceUuid
      email: $email
    ) {
      id
    }
  }
`;

describe("workspaceAddUser", () => {
  test("create the workspace role binding if user already exists", async () => {
    // Create mock user.
    const user = {
      id: casual.uuid
    };

    // Mock up some db functions.
    const email = jest.fn().mockReturnValue({ user });
    const inviteTokensConnection = jest
      .fn()
      .mockReturnValue({ aggregate: { count: 0 } });
    const workspace = jest.fn();
    const createRoleBinding = jest.fn();
    const createInviteToken = jest.fn();

    // Construct db object for context.
    const db = {
      query: { email, inviteTokensConnection, workspace },
      mutation: { createRoleBinding, createInviteToken }
    };

    const vars = {
      workspaceUuid: casual.uuid,
      email: casual.email
    };

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, { db }, vars);
    expect(res.errors).toBeUndefined();
    expect(email).toHaveBeenCalled();
    expect(createRoleBinding).toHaveBeenCalled();
    expect(inviteTokensConnection).not.toHaveBeenCalled();
    expect(createInviteToken).not.toHaveBeenCalled();
    expect(workspace).toHaveBeenCalled();
  });

  test("throws creating invite token if one already exists", async () => {
    // Mock up some db functions.
    const email = jest.fn();
    const inviteTokensConnection = jest
      .fn()
      .mockReturnValue({ aggregate: { count: 1 } });
    const workspace = jest.fn();
    const createRoleBinding = jest.fn();
    const createInviteToken = jest.fn();

    // Construct db object for context.
    const db = {
      query: { email, inviteTokensConnection, workspace },
      mutation: { createRoleBinding, createInviteToken }
    };

    const vars = {
      workspaceUuid: casual.uuid,
      email: casual.email
    };

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, { db }, vars);
    expect(res.errors).toHaveLength(1);

    expect(res.errors[0].message).toEqual(
      // Orbit expects this to match to show the right message
      expect.stringMatching(/already invited/i)
    );
    expect(res.errors[0].extensions.code).toBe("USER_ALREADY_INVITED");
    expect(email).toHaveBeenCalled();
    expect(createRoleBinding).not.toHaveBeenCalled();
    expect(inviteTokensConnection).toHaveBeenCalled();
    expect(createInviteToken).not.toHaveBeenCalled();
    expect(workspace).not.toHaveBeenCalled();
  });

  test("creates token if user does not yet exist and there is not an existing invite", async () => {
    const vars = {
      workspaceUuid: casual.uuid,
      email: casual.email
    };
    // Mock up some db functions.
    const email = jest.fn();
    const inviteTokensConnection = jest
      .fn()
      .mockReturnValue({ aggregate: { count: 0 } });
    const workspace = jest.fn().mockReturnValue({ id: vars.workspaceUuid });
    const createRoleBinding = jest.fn();
    const createInviteToken = jest
      .fn()
      .mockReturnValue({ workspace: { label: "joe@example.com's Workspace" } });

    // Construct db object for context.
    const db = {
      query: { email, inviteTokensConnection, workspace },
      mutation: { createRoleBinding, createInviteToken }
    };

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, { db }, vars);
    expect(res.errors).toBeUndefined();
    expect(email).toHaveBeenCalled();
    expect(createRoleBinding).not.toHaveBeenCalled();
    expect(inviteTokensConnection).toHaveBeenCalled();
    expect(createInviteToken).toHaveBeenCalled();
    expect(createInviteToken.mock.calls[0][0]).toHaveProperty(
      "data.token",
      expect.any(String)
    );
    expect(workspace).toHaveBeenCalled();

    expect(res.data.workspaceAddUser).toHaveProperty("id", vars.workspaceUuid);

    expect(sendEmail).toBeCalledWith(vars.email, "user-invite", {
      strict: true,
      orbitUrl: "http://app.astronomer.io:5000",
      token: createInviteToken.mock.calls[0][0].data.token,
      workspaceLabel: "joe@example.com's Workspace"
    });
  });
});
