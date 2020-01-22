import log from "logger";
import shortid from "shortid";
import { bind, curry, partial } from "lodash";

/*
 * Create a pubsub poller. This creates an object that looks
 * the same as a typical asyncIterator, but also takes care of
 * cancelling a poller.
 * @param {Function} func A function that is passed an iterator that can be used to produce data.
 * @param {Object} pubsub An instance of a PubSub engine.
 * @param {Integer} interval The interval to call the function.
 * @param {Integer} timeout Kill the subscription after this amount of time, never if undefined.
 */
export default function createPoller(
  func,
  pubsub,
  interval = 5000, // Poll every 5 seconds
  timeout = 3600000 // Kill after 1 hour
) {
  // Gernate a random internal topic.
  const topic = shortid.generate();

  // Create an async iterator. This is what a subscription resolver expects to be returned.
  const iterator = pubsub.asyncIterator(topic);

  // Wrap the publish function on the pubsub object, pre-populating the topic.
  const publish = bind(curry(pubsub.publish, 2)(topic), pubsub);

  // Call the function once to get initial dataset.
  func(publish);

  // Then set up a timer to call the passed function. This is the poller.
  const poll = setInterval(partial(func, publish), interval);

  // If we are passed a timeout, kill subscription after that interval has passed.
  const kill = setTimeout(iterator.return, timeout);

  // Create a typical async iterator, but overwrite the return function
  // and cancel the timer. The return function gets called by the apollo server
  // when a subscription is cancelled.
  iterator.return = () => {
    log.info(`Disconnecting subscription ${topic}`);
    clearInterval(poll);
    clearTimeout(kill);
    return Promise.resolve({ value: undefined, done: true });
  };

  iterator.throw = error => {
    return Promise.reject(error);
  };

  // Return the AsyncIterator
  return iterator;
}
