export default async function deploymentAlertsUpdate(parent, args, ctx) {
  const alertEmails = { set: args.alertEmails };
  const where = { id: args.deploymentUuid };
  const data = { alertEmails };
  const updatedDeployment = await ctx.db.mutation.updateDeployment(
    { where, data },
    `{id}`
  );
  return updatedDeployment;
}
