/*
 * Verify a users email address.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {Deployment} The updated Deployment.
 */
export default async function verifyEmail(parent, args, ctx) {
  // Pull out the email address.
  const { email } = args;

  // Update email to be verified.
  const where = { address: email };
  const data = { verified: true };
  await ctx.db.mutation.updateEmail({ where, data });

  // Always return true.
  return true;
}
