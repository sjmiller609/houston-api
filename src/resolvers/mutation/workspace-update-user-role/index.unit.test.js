import resolvers from "resolvers";
import casual from "casual";
import { graphql } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { importSchema } from "graphql-import";
import { WORKSPACE_EDITOR } from "constants";

// Import our application schema
const schema = makeExecutableSchema({
  typeDefs: importSchema("src/schema.graphql"),
  resolvers
});

jest.mock("emails");

// Define our mutation
const query = `
  mutation workspaceUpdateUserRole(
    $workspaceUuid: Uuid!
    $email: String!
    $role: Role!
  ) {
    workspaceUpdateUserRole(
      workspaceUuid: $workspaceUuid
      email: $email
      role: $role
    ) 
  }
`;

describe("workspaceUpdateUserRole", () => {
  let roleBindingsQ = jest.fn(async () => []);
  let inviteTokensQ = jest.fn(async () => []);
  let updateRoleBinding = jest.fn();
  let updateInviteToken = jest.fn();
  let ctx = {
    db: {
      query: { roleBindings: roleBindingsQ, inviteTokens: inviteTokensQ },
      mutation: { updateRoleBinding, updateInviteToken }
    }
  };
  test("yields NotFound error when user or invite not found", async () => {
    const email = casual.email;

    // Mock up some db functions.

    const vars = {
      workspaceUuid: casual.uuid,
      email: email,
      role: WORKSPACE_EDITOR
    };

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, ctx, vars);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0]).toHaveProperty(
      "extensions.code",
      "RESOURCE_NOT_FOUND"
    );
    expect(updateRoleBinding).not.toHaveBeenCalled();
  });

  test("update the roleBinding when user exists", async () => {
    const email = casual.email;
    const rb = { id: casual.uuid };

    const vars = {
      email,
      workspaceUuid: casual.uuid,
      role: WORKSPACE_EDITOR
    };

    roleBindingsQ.mockImplementationOnce(async () => [rb]);

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, ctx, vars);
    expect(res.errors).toBeUndefined();
    expect(res.data.workspaceUpdateUserRole).toBe(WORKSPACE_EDITOR);

    expect(updateRoleBinding).toHaveBeenCalledWith({
      data: { role: vars.role },
      where: rb
    });
  });

  test("update the role field when InviteToken exists", async () => {
    // Create mock user.
    const email = casual.email;
    const invite = { id: casual.uuid };

    const vars = {
      email,
      workspaceUuid: casual.uuid,
      role: WORKSPACE_EDITOR
    };

    inviteTokensQ.mockImplementationOnce(async () => [invite]);

    // Run the graphql mutation.
    const res = await graphql(schema, query, null, ctx, vars);
    expect(res.errors).toBeUndefined();
    expect(res.data.workspaceUpdateUserRole).toBe(WORKSPACE_EDITOR);

    expect(updateRoleBinding).not.toHaveBeenCalled();
    expect(updateInviteToken).toHaveBeenCalledWith({
      data: { role: vars.role },
      where: invite
    });
  });
});
