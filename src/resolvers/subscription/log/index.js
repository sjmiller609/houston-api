import log from "logger";
import createPoller from "pubsub/poller";
import { formatLogDocument, search } from "deployments/logs";
import { get } from "lodash";
import config from "config";
import moment from "moment";

export async function subscribe(parent, args, { db, pubsub }) {
  log.info("Starting log subscription");

  const { releaseName } = await db.query.deployment(
    { where: { id: args.deploymentUuid, deletedAt: null } },
    `{ releaseName }`
  );

  const component = args.component;
  const searchPhrase = get(args, "search");
  const interval = get(
    args,
    "interval",
    config.get("elasticsearch.pollInterval")
  );

  // This variable gets reset to the timestamp of the latest record
  // that was previously published to the client. It will then be used
  // in the next iteration to get new records.
  let gt = moment();

  // Return a wrapped asyncIterator, killing the subscription after 20 minutes.
  return createPoller(
    publish => {
      search(releaseName, component, gt, searchPhrase).then(res => {
        // Pull out the result documents.
        // We reverse the results here because we're sorting in
        // decending order in our ES query to ensure we're getting
        // the latest chunk of records if the result set is larger than our
        // size parameter.
        const hits = get(res, "hits.hits", []).reverse();
        log.debug(`Got ${hits.length} hits in subscription query`);

        // Publish the records to the PubSub engine, and set the
        // most recent record timestamp.
        hits.forEach(log => {
          publish({ log: formatLogDocument(log) });
          gt = moment(log._source["@timestamp"]);
        });
      });
    },
    pubsub,
    interval,
    1200000
  );
}

export default { subscribe };
