import { catchAsyncError } from "./express";

describe("catchAsyncError", () => {
  test("calls the wrapped function with correct args", async () => {
    // Mock an `async` route handler.
    const handler = jest.fn().mockImplementationOnce(() => Promise.resolve());

    // Wrap the route handler with the error handler.
    const wrappedHandler = catchAsyncError(handler);

    // Call the wrapped handler.
    await wrappedHandler(1, 2, 3);
    expect(handler).toHaveBeenCalledWith(1, 2, 3);
  });

  test("catches error from handler", async () => {
    // Mock an `async` route handler.
    const handler = jest
      .fn()
      .mockImplementationOnce(() => Promise.reject(new Error("Bad Thing")));

    // Wrap the route handler with the error handler.
    const wrappedHandler = catchAsyncError(handler);

    // Mock the express `next` function as 3rd arg to handler.
    const next = jest.fn();

    // Call the wrapped handler.
    await wrappedHandler(1, 2, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
