import { DuplicateEmailError, UserInviteExistsError } from "errors";
import { orbit } from "utilities";
import { sendEmail } from "emails";
import shortid from "shortid";

export default async function inviteUser(parent, args, ctx) {
  let { email } = args;
  email = email.toLowerCase();

  // Check for user by incoming email arg.
  const emailRow = await ctx.db.query.email(
    { where: { address: email } },
    `{ user { id } }`
  );

  if (emailRow) {
    throw new DuplicateEmailError();
  }

  // Check if we have an invite for incoming email and user.
  const existingInvites = await ctx.db.query.inviteTokensConnection(
    {
      where: { email }
    },
    `{ aggregate { count } }`
  );
  if (existingInvites.aggregate.count > 0) throw new UserInviteExistsError();

  const token = shortid.generate();
  // Create the invite token if we didn't already have one.
  // Multi-column unique fields would be nice, but not supported yet
  // https://github.com/prisma/prisma/issues/3405
  await ctx.db.mutation.createInviteToken(
    {
      data: {
        email,
        token
      }
    },
    `{ token }`
  );

  sendEmail(email, "user-invite", {
    strict: true,
    orbitUrl: orbit(),
    token
  });

  return true;
}
