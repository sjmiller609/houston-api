import { updateStripeCustomer } from "stripe";

/*
 * Update a credit card associated with a Workspace.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {Card} The card information for the customer added.
 */
export default async function updateCard(parent, args, ctx) {
  // Get the stripeCustomerId associated with the user
  const { stripeCustomerId } = await ctx.db.query.workspace(
    { where: { id: args.workspaceUuid } },
    `{ stripeCustomerId }`
  );

  const response = await updateStripeCustomer(
    stripeCustomerId,
    args.billingEmail,
    args.token,
    args.company
  );

  const cardInfo = response.sources.data[0] || {};

  const card = {
    expMonth: cardInfo.exp_month,
    expYear: cardInfo.exp_year,
    last4: cardInfo.last4,
    name: cardInfo.name,
    brand: cardInfo.brand,
    billingEmail: cardInfo.email,
    company: cardInfo.metadata.company
  };
  return card;
}
