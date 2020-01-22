import { MissingTLSCertificateError } from "errors";
import log from "logger";
import { getCookieName } from "utilities";
import jwt from "jsonwebtoken";
import config from "config";
import ms from "ms";
import { memoize, partial } from "lodash";
import path from "path";
import fs from "fs";

/*
 * Create a new auth JWT for houston.
 * @param {String} userId A users id.
 * @return {String} The token.
 */
export function createAuthJWT(userId) {
  // Return token and claims object for legacy purposes.
  return createJWT({ uuid: userId }, { returnPayload: true });
}

/*
 * Create a signed JWT token
 * @param {Object} payload Claims to turn in to JWT token
 * @param {Object} [opts] Options
 * @param {boolean} opts.returnPayload Do we return the token and the modified
 *                  payload object, or just the token
 * @return {(string|Object)} The signed token, or `{token, payload}`
 */
export function createJWT(payload, opts) {
  const millis = config.get("jwt.authDuration");

  opts = opts || {};

  // Create the payload.
  const { signWith, alg } = jwtSigningParam();
  const token = jwt.sign(payload, signWith, {
    expiresIn: ms(millis),
    notBefore: 0,
    mutatePayload: !!opts.returnPayload,
    algorithm: alg
  });

  if (opts.returnPayload) return { token, payload };
  return token;
}

/*
 * Set a jwt on http response.
 * @param {Object} response HTTP response.
 * @param {String} token JWT.
 */
export function setJWTCookie(response, token) {
  const millis = config.get("jwt.authDuration");

  // Set the cookie.
  return response.cookie(getCookieName(), token, {
    domain: `.${config.get("helm.baseDomain")}`,
    path: "/",
    expires: new Date(Date.now() + millis),
    secure: true
  });
}

/*
 * Decode a JWT.
 * @return {Object} The decoded JWT.
 */
export function decodeJWT(token) {
  // Decode the JWT.
  return new Promise(resolve => {
    const { signWith, algs } = jwtValidationParam();
    jwt.verify(token, signWith, { algorithms: algs }, (err, decoded) => {
      if (err) return resolve({});
      return resolve(decoded);
    });
  });
}

// To make it easier in development we fallback to signing JWTs with a
// symetric passhprase. But in any other NODE_ENV the certificiate is a
// requirment.
const jwtSigningParam = memoize(() => {
  if (
    process.env.NODE_ENV === "development" &&
    config.get("jwt.certPath") === null
  ) {
    log.warn("Signing JWT tokens with shared key (only allowed in dev!)");
    return { signWith: config.get("jwt.passphrase"), alg: "HS256" };
  }

  return { signWith: getHoustonCertificate().key, alg: "RS256" };
});

const jwtValidationParam = memoize(() => {
  if (
    process.env.NODE_ENV === "development" &&
    config.get("jwt.certPath") === null
  ) {
    log.warn("Validating JWT tokens with shared key (only allowed in dev!");
    return { signWith: config.get("jwt.passphrase"), algs: ["HS256"] };
  }

  return { signWith: getHoustonCertificate().crt, algs: ["RS256"] };
});

/*
 * Load up a certificate at the specified path.
 */
function loadCertificate(certPath) {
  try {
    const crt = fs.readFileSync(path.join(certPath, "tls.crt"));
    const key = fs.readFileSync(path.join(certPath, "tls.key"));
    return { crt, key };
  } catch {
    throw new MissingTLSCertificateError();
  }
}

/*
 * Load the Houston JWT signing private key into memory.
 * @return {Object} The contents of the cert and key files.
 */
export const getHoustonCertificate = memoize(
  partial(loadCertificate, config.get("jwt.certPath"))
);

/*
 * Load the Docker Registry JWT signing private key into memory.
 * @return {Object} The contents of the cert and key files.
 */
export const getRegistryCertificate = memoize(
  partial(loadCertificate, config.get("jwt.registry.certPath"))
);
