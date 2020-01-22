import createPoller from "./index";
import { PubSub } from "apollo-server";

beforeEach(() => {
  jest.useFakeTimers();
});

describe("createPoller", () => {
  test("it correctly polls the given function", () => {
    // Create a mock poller.
    const func = jest.fn();

    // Create our iterator, 1 sec interval, 10 min timeout.
    const iterator = createPoller(func, new PubSub(), 1000, 600000);
    expect(iterator).toHaveProperty("return");

    // Expect our timers to have been set up.
    expect(setInterval).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenCalledTimes(1);

    // Fast-forward, expect we've polled appropriately.
    jest.advanceTimersByTime(10000);

    // +1 for initial call.
    expect(func).toHaveBeenCalledTimes(11);
  });
});
