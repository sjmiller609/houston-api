import resolvers from "resolvers";
import { sendEmail } from "emails";
import casual from "casual";
import { graphql } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { importSchema } from "graphql-import";

// Import our application schema
const schema = makeExecutableSchema({
  typeDefs: importSchema("src/schema.graphql"),
  resolvers
});

jest.mock("emails");

// Define our mutation
const gql = `
  mutation inviteUser(
    $email: String!
  ) {
    inviteUser(email: $email)
  }
`;

describe("inviteUser", () => {
  // Vars for the gql mutation.
  const vars = { email: casual.email.toLowerCase() };

  const emailQuery = jest.fn().mockReturnValue(null);
  const inviteTokensConnection = jest
    .fn()
    .mockReturnValue({ aggregate: { count: 0 } });
  const createInviteToken = jest.fn();
  // Construct db object for context.
  const db = {
    query: { email: emailQuery, inviteTokensConnection },
    mutation: { createInviteToken }
  };

  test("when inviting a new user", async () => {
    const res = await graphql(schema, gql, null, { db }, vars);
    expect(res).not.toHaveProperty("errors");

    expect(createInviteToken).toHaveBeenCalledWith(
      {
        data: {
          email: vars.email,
          token: expect.any(String)
        }
      },
      // We don't care what fields we select here.
      expect.any(String)
    );

    expect(sendEmail).toBeCalledWith(vars.email, "user-invite", {
      strict: true,
      orbitUrl: "http://app.astronomer.io:5000",
      token: createInviteToken.mock.calls[0][0].data.token
    });
  });

  test("when trying to invite an existing user", async () => {
    emailQuery.mockReturnValueOnce({ user: { id: casual.uuid } });
    const res = await graphql(schema, gql, null, { db }, vars);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0]).toHaveProperty("extensions.code", "DUPLICATE_EMAIL");
  });

  test("when trying to invite an existing invite", async () => {
    inviteTokensConnection.mockReturnValueOnce({ aggregate: { count: 1 } });
    const res = await graphql(schema, gql, null, { db }, vars);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0]).toHaveProperty(
      "extensions.code",
      "USER_ALREADY_INVITED"
    );
  });
});
