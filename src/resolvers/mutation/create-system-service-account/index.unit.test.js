import resolvers from "resolvers";
import casual from "casual";
import { graphql } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { importSchema } from "graphql-import";
import { SYSTEM_ADMIN, WORKSPACE_ADMIN } from "constants";

// Import our application schema
const schema = makeExecutableSchema({
  typeDefs: importSchema("src/schema.graphql"),
  resolvers
});

// Define our mutation
const mutation = `
  mutation createSystemServiceAccount(
    $label: String!,
    $category: String,
    $role: Role!
  ) {
    createSystemServiceAccount(
      label: $label,
      category: $category,
      role: $role
    ) {
      id
      label
      apiKey
      entityType
      workspaceUuid
      category
      active
      lastUsedAt
      createdAt
      updatedAt
    }
  }
`;

describe("createSystemServiceAccount", () => {
  test("typical request is successful", async () => {
    // Create mock user.
    const user = {
      id: casual.uuid,
      username: casual.email,
      roleBindings: [
        {
          role: SYSTEM_ADMIN
        }
      ]
    };

    // Create mock function.
    const createServiceAccount = jest.fn();

    // Construct db object for context.
    const db = {
      mutation: { createServiceAccount }
    };

    // Create variables.
    const vars = {
      label: casual.word,
      category: casual.word,
      role: SYSTEM_ADMIN
    };

    const data = {
      active: true,
      apiKey: expect.anything(),
      category: vars.category,
      label: vars.label,
      roleBinding: {
        create: { role: SYSTEM_ADMIN }
      }
    };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db, user }, vars);

    expect(res.errors).toBeUndefined();
    expect(createServiceAccount).toBeCalledWith(
      expect.objectContaining({ data }),
      expect.any(Object)
    );
    expect(createServiceAccount.mock.calls).toHaveLength(1);
  });

  test("request throws if requested role is invaid", async () => {
    // Create the mock user
    const user = {
      id: casual.uuid,
      username: casual.email,
      roleBindings: [
        {
          role: SYSTEM_ADMIN
        }
      ]
    };

    // Mock up some db functions.
    const createServiceAccount = jest.fn();
    // Construct db object for context.
    const db = {
      mutation: { createServiceAccount }
    };

    const vars = {
      label: casual.word,
      category: casual.word,
      role: WORKSPACE_ADMIN
    };

    // Run the graphql mutation.
    const res = await graphql(schema, mutation, null, { db, user }, vars);
    expect(res.errors).toHaveLength(1);
    expect(createServiceAccount).toHaveBeenCalledTimes(0);
  });
});
