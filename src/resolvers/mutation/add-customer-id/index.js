/*
 * Add a stripeCustomerId to the workspace table in the database. Allows a workspace to exit trial mode without inputting a credit card.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {Card} The card information for the customer added.
 */
export default async function addCustomerId(parent, args, ctx) {
  const { stripeCustomerId, workspaceUuid } = args;

  const data = {
    stripeCustomerId,
    isSuspended: false,
    trialEndsAt: new Date()
  };

  const where = { id: workspaceUuid };

  const response = await ctx.db.mutation.updateWorkspace({
    data,
    where
  });

  return response;
}
