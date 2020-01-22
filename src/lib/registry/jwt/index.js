import { getRegistryCertificate } from "jwt";
import { generateKid } from "registry/libtrust";
import jwt from "jsonwebtoken";
import config from "config";
import crypto from "crypto";

/*
 * Create a new JWT for the docker registry.
 * @param {String} userId (sub) A users id.
 * @param {Object} payload (access) JWT payload.
 * @return {Promise<String>} The token.
 */
export function createDockerJWT(sub, access, expiration = 3600) {
  const { crt, key } = getRegistryCertificate();
  const { issuer: iss, service: aud } = config.get("jwt.registry");
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiration;
  const jti = crypto.randomBytes(16).toString("hex");
  const payload = { iss, sub, aud, exp, jti, nbf: now, iat: now, access };
  return jwt.sign(payload, key, {
    algorithm: "RS256",
    header: { kid: generateKid(crt) }
  });
}
