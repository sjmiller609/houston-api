/*
 * Wrap an express route handler with an error handler.
 * This ensures that next() is called in the event of
 * an unexpected error in the wrapped handler.
 */
export const catchAsyncError = fn => (...args) => fn(...args).catch(args[2]);
