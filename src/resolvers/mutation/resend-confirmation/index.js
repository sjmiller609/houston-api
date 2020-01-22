import { orbit } from "utilities";
import { sendEmail } from "emails";
import shortid from "shortid";

/*
 * Resend an email confirmation
 *
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {Boolean} Status of the request.
 */
export default async function resendConfirmation(parent, args, ctx) {
  // Check for user by incoming email arg.
  const email = await ctx.db.query.email(
    { where: { address: args.email.toLowerCase() } },
    `{
      id
      address
      verified
      token
    }`
  );

  if (!email || email.verified) {
    return false;
  }

  if (!email.token) {
    email.token = shortid.generate();
    await ctx.db.mutation.updateEmail({
      data: { token: email.token },
      where: { id: email.id }
    });
  }
  sendEmail(email.address, "confirm-email", {
    token: email.token,
    strict: true,
    orbitUrl: orbit()
  });
  return true;
}
