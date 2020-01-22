/*
 * Get a list of all invites,
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {[]Invites} A list of invites.
 */
export default async function invites(parent, args, ctx) {
  // Build the users query.
  const query = invitesQuery(args);

  // Run final query
  return await ctx.db.query.inviteTokens(query);
}

/*
 * Build the invites query based on args.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {Object} The users query.
 */
export function invitesQuery(args) {
  // Pull out some args.
  const { email } = args;

  // If we have an email use it.
  if (email) return { where: { email_contains: email.toLowerCase() } };

  return null;
}
