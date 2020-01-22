import { enabledProviders, getClient } from "oauth/config";
import { prisma } from "generated/client";
import config from "config";

/*
 * Return a boolean indicating if public signups are enabled.
 * @return {Boolean} Public signups enabled.
 */
export function publicSignup() {
  return config.get("publicSignups");
}

/*
 * Return a boolean indicating if there is an initial signup yet.
 * @return {Boolean} Initial signup.
 */
export async function initialSignup() {
  const count = await prisma
    .usersConnection({})
    .aggregate()
    .count();

  return count === 0;
}

/*
 * Return a boolean indicating if local auth is enabled.
 * @return {Boolean} Local auth enabled.
 */
export function localEnabled() {
  return config.get("auth.local.enabled");
}

export async function providers(parent) {
  return Promise.all(
    enabledProviders().map(async name => {
      const client = await getClient(name);
      return {
        name: name,
        url: client.authUrl(parent),
        displayName: client.metadata.displayName
      };
    })
  );
}

export default {
  publicSignup,
  initialSignup,
  localEnabled,
  providers
};
