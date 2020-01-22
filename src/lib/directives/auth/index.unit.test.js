import AuthDirective from "./index";
import { PermissionError } from "errors";
import { graphql } from "graphql";
import { makeExecutableSchema, SchemaDirectiveVisitor } from "graphql-tools";

// A minimal schema for testing against
const typeDefs = `
directive @auth(
  permissions: [String],
  op: Operator = AND
) on OBJECT | FIELD_DEFINITION

enum Operator {
  AND
  OR
}

type User {
  id: ID!
}
type Query {
  self: User! @auth
  adminOnly: User! @auth(permissions: ["system.fake.permission"] op: AND)
  anon: User!

  describeWorkspace(
    workspaceUuid: ID!
  ): Boolean @auth(permissions: ["workspace.fake.permission"] op: AND)

  describeDeployment(
    deploymentUuid: ID!
  ): Boolean @auth(permissions: ["deployment.fake.permission"] op: AND)

  describeSecretThing: Boolean @auth(permissions: ["secret.fake.permission", "secret.fake.permission2"] op: AND)

  describeSecretThing2: Boolean @auth(permissions: ["secret.fake.permission", "secret.fake.permission2"] op: OR)
}
`;

const resolvers = {
  Query: {
    self: () => {
      return { id: 1 };
    },
    adminOnly: () => {
      return { id: 1 };
    },
    anon: () => {
      return { id: 1 };
    },
    describeDeployment: () => true,
    describeWorkspace: () => true,
    describeSecretThing: () => true,
    describeSecretThing2: () => true
  }
};

const mockHasPerms = jest.fn(() => true);

// A Test class that uses a mock hasPermissions to ease testing
class TestingAuthDirective extends AuthDirective {
  constructor({ ...args }) {
    args.hasPermission = mockHasPerms;
    super(args);
  }
}

let schema;

beforeAll(() => {
  schema = makeExecutableSchema({
    typeDefs,
    resolvers,
    schemaDirectives: { auth: TestingAuthDirective }
  });
});

async function runQuery(query, ctxArgs, params = null) {
  return graphql(schema, query, null, makeContext(ctxArgs), params);
}

function makeContext({ auth = false, user = undefined }) {
  if (auth && !user) {
    user = { roleBindings: [] };
  }
  return {
    req: {
      session: { user }
    }
  };
}

test("pre-conditions", () => {
  expect(AuthDirective.prototype).toBeInstanceOf(SchemaDirectiveVisitor);
  expect(schema).toBeTruthy();
});

describe("@auth directive", () => {
  test("doesn't affect undecorated directives", async () => {
    const query = `
      query {
        anon {
          id
        }
      }
    `;
    const { data, errors } = await runQuery(query, { auth: false });

    expect(errors).toBeUndefined();
    expect(data).toHaveProperty("anon.id", "1");
  });

  describe("on query without specific permission", () => {
    let queryType;

    const query = `
      query {
        self {
          id
        }
      }
    `;

    beforeAll(() => {
      queryType = schema.getQueryType().getFields()["self"];
    });

    test("should be decorated", () => {
      expect(queryType).toHaveProperty("authDirective");
    });

    test("should be allowed with right role", async () => {
      const { data, errors } = await runQuery(query, { auth: true });

      expect(errors).toBeUndefined();
      expect(data).toHaveProperty("self.id", "1");
    });
  });

  describe("on query requiring specific permission", () => {
    const query = `
      query {
        adminOnly {
          id
        }
      }
    `;

    test("should be decorated", () => {
      let queryType = schema.getQueryType().getFields()["adminOnly"];
      expect(queryType).toHaveProperty("authDirective");
    });

    test("should be allowed when we have the specific role", async () => {
      const { data, errors } = await runQuery(query, {
        user: { roleBinding: [{ role: "admin" }] }
      });

      expect(errors).toBeUndefined();
      expect(data).toHaveProperty("adminOnly.id", "1");
      expect(mockHasPerms).toHaveBeenCalledWith(
        { roleBinding: [{ role: "admin" }] },
        "system.fake.permission",
        null,
        null
      );
    });

    test("should not be allowed as regular user", async () => {
      mockHasPerms.mockImplementationOnce(() => throw new PermissionError());

      const { data, errors } = await runQuery(query, { auth: true });

      expect(errors).toHaveLength(1);
      expect(errors[0]).toHaveProperty("extensions.code", "FORBIDDEN");
      expect(data).toBeNull();
      expect(mockHasPerms).toHaveBeenCalledWith(
        expect.anything(),
        "system.fake.permission",
        null,
        null
      );
    });
  });

  describe("on query requring deployment-specific permission", () => {
    const query = `
      query describeDeployment($id: ID!) {
        describeDeployment(deploymentUuid: $id)
      }
    `;

    test("should check the permissions for the specific entity", async () => {
      let vars = { id: "d-2" };
      const { errors } = await runQuery(query, { auth: true }, vars);
      expect(errors).toBeUndefined();
      expect(mockHasPerms).toHaveBeenCalledWith(
        expect.anything(),
        "deployment.fake.permission",
        "deployment",
        vars.id
      );
    });
  });

  describe("on query requiring workspace-specific permission", () => {
    const query = `
      query describeWorkspace($id: ID!) {
        describeWorkspace(workspaceUuid: $id)
      }
    `;

    test("should check the permissions for the specific entity", async () => {
      let vars = { id: "w-2" };
      const { errors } = await runQuery(query, { auth: true }, vars);
      expect(errors).toBeUndefined();
      expect(mockHasPerms).toHaveBeenCalledWith(
        expect.anything(),
        "workspace.fake.permission",
        "workspace",
        vars.id
      );
    });
  });

  describe("on resolver checking permission operator", () => {
    const query = `
      query describeSecretThing {
        describeSecretThing
      }
    `;

    const query2 = `
    query describeSecretThing2 {
      describeSecretThing2
    }
  `;

    test("should call hasPermission twice with AND operator", async () => {
      const { errors } = await runQuery(query, {
        user: { roleBinding: [{ role: "admin" }] }
      });
      expect(errors).toBeUndefined();
      expect(mockHasPerms).toHaveBeenCalledTimes(2);
    });

    test("should call hasPermission once with OR operator if fails on first permission", async () => {
      mockHasPerms.mockImplementationOnce(() => throw new PermissionError());
      const { errors } = await runQuery(query2, {
        user: { roleBinding: [{ role: "admin" }] }
      });
      expect(errors).toHaveLength(1);
      expect(mockHasPerms).toHaveBeenCalledTimes(1);
    });
  });
});
