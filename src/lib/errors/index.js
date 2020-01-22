import log from "logger";

/*
 * Log formatter for Apollo Server
 * @param {Object} error An erorr that occured on the server.
 */
export function formatError(error) {
  log.error(error);
  return error;
}

export * from "./errors";
export * from "./prisma";
export * from "./express";
