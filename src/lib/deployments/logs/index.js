import sampleLogs from "./sample";
import log from "logger";
import config from "config";
import elasticsearch from "elasticsearch";
import { clone, random, range } from "lodash";
import casual from "casual";

/*
 * This is a singleton instance of a log generator. It
 * infinately iterates over sample logs.
 */
export const generateLogMessage = (function* generateLogs() {
  const max = sampleLogs.length;
  let counter = 0;
  while (true) {
    yield sampleLogs[++counter];
    if (counter == max) counter = 0;
  }
})();

/*
 * Generate full sample elasticsearch log records, using
 * the log message generator, for a given release, component.
 * @param {String} release A release name.
 * @param {String} component A deployment component.
 * @return {[]Object} A randomly sized array of log records.
 */
export function generateMockLogRecords(release, component) {
  return {
    hits: {
      hits: range(random(2)).map(() => ({
        _id: casual.uuid,
        _source: {
          release,
          component,
          message: generateLogMessage.next().value,
          "@timestamp": new Date()
        }
      }))
    }
  };
}

/*
 * Return an elasticsearch search query for the given args.
 * @param {String} release An airflow release name.
 * @param {String} component An airflow deployment component name (scheduler|webserver|worker).
 * @param {String} gt Timestamp results should be greater than.
 * @param {String} searchPhrase A phrase to search the log records for.
 * @return {Object} An elasticsearch query.
 */
export function createLogQuery(release, component, gt, searchPhrase) {
  const query = {
    index: `fluentd.${release}.*`,
    sort: "@timestamp:desc",
    // This matches a value in orbit.
    // It's equal to the maximum records orbit will keep in its cache.
    size: 800,
    body: {
      query: {
        bool: {
          // Always match against the deployment release name.
          must: [{ match: { release } }],
          // Filter out the end_of_log messages the airflow task logs use.
          must_not: [{ match: { message: "end_of_log" } }]
        }
      }
    }
  };

  if (gt) {
    query.body.query.bool.filter = {
      range: { "@timestamp": { gt } }
    };
  }

  if (component) {
    query.body.query.bool.must.push({
      match: { component: component }
    });
  }

  if (searchPhrase) {
    query.body.query.bool.must.push({
      match_phrase: { message: searchPhrase }
    });
  }

  return query;
}

/*
 * Execute a search query aginst elasticsearch.
 * This is a wrapper around the function above to skip
 * if elasticsearch is disabled.
 */
export async function search(...args) {
  const { enabled, client, mockInDevelopment } = config.get("elasticsearch");

  if (enabled) {
    const es = elasticsearch.Client(clone(client));
    const query = createLogQuery(...args);
    return await es.search(query);
  }

  const isDev = process.env.NODE_ENV !== "production";
  if (isDev && mockInDevelopment) {
    log.debug(`Elasticsearch disabled, returning sample logs`);
    return generateMockLogRecords(args[0], args[1]);
  }
  log.debug(`Elasticsearch disabled, returning nothing`);
}

/*
 * Map an Elasticsearch log document to the format expected on the client.
 * @param {Object} document An elasticsearch result document.
 * @return {Object} The properly formatted object.
 */
export function formatLogDocument({ _id: id, _source: src }) {
  // Deconstruct and rename some variables from the log object.
  const { component, release, "@timestamp": timestamp, message } = src;

  // Return the fields in the expected format.
  return { id, component, release, timestamp, message };
}
