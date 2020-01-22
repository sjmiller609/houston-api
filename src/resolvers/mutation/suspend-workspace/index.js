export default async function suspendWorkspace(parent, args, ctx) {
  const workspace = await ctx.db.mutation.updateWorkspace({
    data: {
      isSuspended: args.isSuspended
    },
    where: {
      id: args.workspaceUuid
    }
  });

  return workspace;
}
