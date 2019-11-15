import log from "logger";
import Stripe from "stripe-api";
import config from "config";

const { enabled, secretKey } = config.get("stripe");
const stripe = Stripe(secretKey);

export function createStripeCustomer(
  company,
  billingEmail,
  token,
  workspaceUuid
) {
  if (!enabled) {
    return log.info("Stripe disabled, payment method cannot be added.");
  }
  return stripe.customers.create({
    name: company,
    email: billingEmail,
    source: token,
    metadata: { workspaceId: workspaceUuid }
  });
}

export function createStripeSubscription(stripeCustomerId) {
  return stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [
      {
        plan: "metered_billing"
      }
    ]
  });
}

export function updateStripeCustomer(
  stripeCustomerId,
  billingEmail,
  token,
  company
) {
  return stripe.customers.update(stripeCustomerId, {
    email: billingEmail,
    source: token,
    metadata: { company: company }
  });
}

export function getStripeCard(stripeCustomerId) {
  return stripe.customers.retrieve(stripeCustomerId);
}
