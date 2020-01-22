import { formatLogDocument, search } from "deployments/logs";
import log from "logger";
import { get } from "lodash";
import moment from "moment";

/*
 * Search for webserver/scheduler/worker logs for a deployment.
 * @param {Object} parent The result of the parent resolver.
 * @param {Object} args The graphql arguments.
 * @param {Object} ctx The graphql context.
 * @return {[]DeploymentLog} A list of DeploymentLogs.
 */
export default async function logs(parent, args, ctx) {
  const { releaseName } = await ctx.db.query.deployment(
    { where: { id: args.deploymentUuid } },
    `{ releaseName }`
  );

  const gt = moment(args.timestamp || 0); // Epoch if null.
  const component = args.component;
  const searchPhrase = get(args, "search");
  const res = await search(releaseName, component, gt, searchPhrase);

  // Return early if we don't have a response, or if es is disabled.
  if (!res) return [];

  // Get the results and transform them before returning.
  // We reverse the results here because we're sorting in
  // decending order in our ES query to ensure we're getting
  // the latest chunk of records if the result set is larger than our
  // size parameter.
  const hits = get(res, "hits.hits", []).reverse();
  log.debug(`Got ${hits.length} hits in search query`);

  return hits.map(formatLogDocument);
}
