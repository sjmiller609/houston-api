import { createUser as _createUser } from "users";
import { throwPrismaError } from "errors";
import { get } from "lodash";
import bcrypt from "bcryptjs";

/*
 * Create a new user. This is the signup mutation.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {AuthToken} The auth token.
 */
export default async function createUser(parent, args, ctx) {
  // Full name is sent in on profile and can fall back to empty string.
  const fullName = get(args, "profile.fullName");

  // Hash password.
  const password = await bcrypt.hash(args.password, 10);

  // Try to create the user,
  // handling error in an orbit-compatible way.
  try {
    // Create the user and nested relations.
    const userId = await _createUser({
      fullName,
      username: args.username,
      email: args.email.toLowerCase(),
      inviteToken: args.inviteToken
    });

    // Create the local credential and connect to user.
    await ctx.db.mutation.createLocalCredential({
      data: {
        password,
        user: { connect: { id: userId } }
      }
    });

    return { userId };
  } catch (e) {
    // This is mostly for compatibility with Orbit.
    // Take a prisma error and throw an error that orbit expects.
    throwPrismaError(e);
  }
}
