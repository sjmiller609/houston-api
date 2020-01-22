import { orbit } from "utilities";
import {
  PublicSignupsDisabledError,
  InviteTokenNotFoundError,
  InviteTokenEmailError
} from "errors";
import { prisma } from "generated/client";
import { sendEmail } from "emails";
import config from "config";
import shortid from "shortid";
import {
  WORKSPACE_ADMIN,
  SYSTEM_ADMIN,
  USER_STATUS_PENDING,
  USER_STATUS_ACTIVE
} from "constants";

/*
 * Centralized helper method to create new user in the system.
 */
export async function createUser(opts) {
  // Pull out some options.
  const { fullName, email, inviteToken: rawInviteToken, active } = opts;
  const username = opts.username || email;
  const inviteTokens = await exports.validateInviteToken(rawInviteToken, email);

  // Grab some configuration.
  const emailConfirmation = config.get("emailConfirmation");
  const publicSignups = config.get("publicSignups");

  // Check if this the first signup.
  const first = await isFirst();
  const haveInvite = inviteTokens.length > 0;

  // If it's not the first signup and we're not allowing public signups, check for invite.
  if (!first && !publicSignups && !haveInvite) {
    throw new PublicSignupsDisabledError();
  }

  // Determine default status. The user is active (doesn't need email
  // confirming) if any of:
  //
  // - Did caller of this function (else where in the code) say we should
  //   create an active user?
  // - Do we have a valid invite token (which must have come via the same
  //   email we are creating)?
  // - Or if emailConfirmation is turned off in the system
  const status =
    active || haveInvite || !emailConfirmation
      ? USER_STATUS_ACTIVE
      : USER_STATUS_PENDING;
  // Generate an verification token.
  const emailToken = status == USER_STATUS_ACTIVE ? null : shortid.generate();

  // Generate the role bindings.
  const roleBindings = exports.generateRoleBindings(first, inviteTokens);

  // Create our base mutation.
  const mutation = {
    username,
    status,
    fullName,
    emails: {
      create: {
        address: email,
        primary: true,
        verified: !!(!emailConfirmation || haveInvite),
        token: emailToken
      }
    },
    roleBindings
  };

  // If we have an invite token, delete it.
  if (haveInvite) {
    await prisma.deleteManyInviteTokens({ id_in: inviteTokens.map(t => t.id) });
  }

  // Run the mutation and return id.
  const id = await prisma.createUser(mutation).id();

  if (emailToken != null) {
    sendEmail(email, "confirm-email", {
      token: emailToken,
      orbitUrl: orbit(),
      strict: true
    });
  }

  return id;
}

/*
 * Check if we have any users in the system yet.
 * @return {Promise<Boolean> User count is 0
 */
export async function isFirst() {
  const count = await prisma
    .usersConnection({})
    .aggregate()
    .count();

  return count == 0;
}

/*
 * Create the role bindings for a new user.
 * @param {Boolean} first If this is the first user.
 * @param {Object} inviteTokens The invite tokens for this address
 */
export function generateRoleBindings(first, inviteTokens) {
  const roleBindings = [];

  for (let inviteToken of inviteTokens) {
    // If we have an invite token, add user to the originating workspace.
    if (inviteToken && inviteToken.workspace) {
      roleBindings.push({
        // We didn't used to put the role in the invite token - if it was missing
        // the invite is from the days when everyone was an admin.
        role: inviteToken.role || WORKSPACE_ADMIN,
        workspace: {
          connect: {
            id: inviteToken.workspace.id
          }
        }
      });
    }
  }

  // Add admin role if first signup.
  if (first) {
    roleBindings.push({
      role: SYSTEM_ADMIN
    });
  }

  // Return combined role bindings.
  return { create: roleBindings };
}

/*
 * Validates that an invite token is valid, throws otherwise.
 * @param {String} inviteToken An invite token.
 * @param {String} email The email of the incoming user.
 * @return {InviteToken} All invite tokens for this email address
 */
export async function validateInviteToken(inviteToken, email) {
  // Return early if no token found.
  if (!inviteToken) return [];

  // Grab the invite token.
  const inviteEmail = await prisma.inviteToken({ token: inviteToken }).email();

  // Throw error if token not found.
  if (!inviteEmail) throw new InviteTokenNotFoundError();

  // Throw error if email does not match.
  if (inviteEmail !== email.toLowerCase()) throw new InviteTokenEmailError();

  // Return validated token, and any other tokens for the same email address.
  return await prisma.inviteTokens({ where: { email } })
    .$fragment(`fragment EnsureFiields on InviteToken {
      id
      email
      token
      role
      workspace {
        id
      }
    }`);
}

/*
 * Generate default workspace label.
 * @param {Object} args The args for the mutation.
 * @return {String} The workspace label.
 */
export function defaultWorkspaceLabel(opts) {
  const labelName = opts.fullName || opts.username;
  return labelName ? `${labelName}'s Workspace` : "Default Workspace";
}

/*
 * Generate default workspace description.
 * @param {Object} opts The opts for the mutation.
 * @return {String} The workspace description.
 */
export function defaultWorkspaceDescription(opts) {
  const descName = opts.fullName || opts.email || opts.username;
  return descName ? `Default workspace for ${descName}` : "Default Workspace";
}
