import { orbit } from "utilities";
import { sendEmail } from "emails";
import shortid from "shortid";

/*
 * Start the forgotten password flow for the given email address.
 *
 * For backwards compatability with the old API this mutation returns a
 * boolean, but unlike the previous version this one does not return false in
 * the case of email not found as that leaks information about who has signed
 * up to the service.
 *
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {Boolean} Status of the request.
 */
export default async function forgotPassword(parent, args, ctx) {
  // Check for user by incoming email arg.
  const email = await ctx.db.query.email(
    { where: { address: args.email.toLowerCase() } },
    `{
      address
      user {
        id
        localCredential {
          id
          resetToken
        }
      }
    }`
  );

  if (!email) {
    sendEmail(args.email, "forgot-password-no-account", { strict: true });
    return true;
  }

  const localCredential = email.user.localCredential;

  if (!localCredential) {
    sendEmail(email.address, "forgot-password-not-local-creds", {
      strict: true
    });
    return true;
  }

  const resetToken =
    email.user.localCredential.resetToken || shortid.generate();

  await ctx.db.mutation.updateLocalCredential({
    data: { resetToken: resetToken },
    where: { id: localCredential.id }
  });
  sendEmail(email.address, "forgot-password", {
    token: resetToken,
    strict: true,
    orbitUrl: orbit()
  });
  return true;
}
