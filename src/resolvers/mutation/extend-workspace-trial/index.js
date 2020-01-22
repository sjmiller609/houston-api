import moment from "moment";

export default async function extendWorkspaceTrial(parent, args, ctx) {
  const { extraDays, workspaceUuid } = args;
  const getWorkspace = await ctx.db.query.workspace(
    { where: { id: workspaceUuid } },
    `{ trialEndsAt }`
  );

  const trialEndsAt = moment(getWorkspace.trialEndsAt, "YYYY-MM-DD")
    .add(extraDays, "d")
    .format();

  const data = { trialEndsAt };

  const where = { id: workspaceUuid };
  const workspace = ctx.db.mutation.updateWorkspace({
    data,
    where
  });

  return workspace;
}
