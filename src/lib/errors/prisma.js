import { DuplicateEmailError } from "./errors";
import { some } from "lodash";

/*
 * Take an error from prisma, and throw an error
 * that is compatible with orbit. This may be removed when
 * we refactor error handling.
 * @param {Object} error The prisma error.
 */
export function throwPrismaError(e) {
  if (duplicateEmailError(e)) {
    throw new DuplicateEmailError();
  }
}

/*
 * Check if error is a duplicate email.
 * @param {Object} error The error from prisma.
 * @return {Boolean} If a uplicate user error is found.
 */
export function duplicateEmailError(e) {
  return hasError(e, 3010, /\b(?:User|Email)\b/);
}

/* Generic function to look for a message in an array
 * of errors from GraphQL.
 *
 * Error codes come from https://github.com/prisma/prisma/blob/5d6e09c2fb1a68dc9e05765629cf31ae3a22bcd4/server/connectors/api-connector/src/main/scala/com/prisma/api/schema/Errors.scala
 *
 * @param {Object} error An error object from prisma (or any GraphQL server).
 * @param {Number} code The prisma server error code to look for
 * @param {RegExp} msg A message to look for in the array.
 * @return {Boolean} If the message was found.
 */
export function hasError(e, code, re) {
  return some(e.result.errors, e => e.code == code && e.message.match(re));
}
