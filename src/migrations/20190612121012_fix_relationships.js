import log from "logger";
import { flatMap } from "lodash";
import { execSync } from "child_process";

const schema = "houston$default";

// List of tables/columns to migrate.
const ops = [
  {
    src: "_DeploymentToRoleBinding",
    dest: "RoleBinding",
    col: "deployment",
    reverse: true,
    data: []
  },
  {
    src: "_DeploymentToWorkspace",
    dest: "Deployment",
    col: "workspace",
    data: []
  },
  {
    src: "_EmailToUser",
    dest: "Email",
    col: "user",
    data: []
  },
  {
    src: "_RoleBindingToServiceAccount",
    dest: "RoleBinding",
    col: "serviceAccount",
    data: []
  },
  {
    src: "_RoleBindingToWorkspace",
    dest: "RoleBinding",
    col: "workspace",
    data: []
  },
  {
    src: "_LocalCredentialToUser",
    dest: "User",
    col: "localCredential",
    reverse: true,
    data: []
  },
  {
    src: "_InviteTokenToWorkspace",
    dest: "InviteToken",
    col: "workspace",
    data: []
  },
  {
    src: "_OAuthCredentialToUser",
    dest: "OAuthCredential",
    col: "user",
    data: []
  },
  {
    src: "_RoleBindingToUser",
    dest: "RoleBinding",
    col: "user",
    data: []
  }
];

/*
 * This migration patches up prisma managed tables to include
 * the foreign keys, rather than the default join tables.
 */
export async function up(knex) {
  let data = [];

  // Create knex transaction.
  await knex.transaction(async function(trx) {
    // Check if we have the old tables..
    const oldSchemaExists = await trx.schema
      .withSchema(schema)
      .hasTable(ops[0].src);

    // Return early if we don't have the old tables.
    // This will skip the migration for fresh installs or any 0.9.x installs.
    if (!oldSchemaExists) {
      return log.debug("Skipping fix_relationships data migration");
    }

    log.debug("Running fix_relationships migration");

    // Collect all the records from the old join tables (A,B mappings).
    data = await Promise.all(
      ops.map(op => {
        log.debug(`Getting records for ${op.src}`);
        return trx
          .withSchema(schema)
          .select("*")
          .from(op.src);
      })
    );
  });

  // Append the data records to the matching table/column structure defined above.
  data.forEach((data, i) => (ops[i].data = data));

  // Now that we have the data from the old tables, run prisma deploy to
  // update to the new schema, deleting the old join tables.
  log.debug("Running prisma-deploy");
  execSync("node_modules/.bin/prisma deploy --force", { stdio: "inherit" });

  await knex.transaction(async function(trx) {
    // Now that the schema is updated, go through and re-map in the foreign key ids.
    await Promise.all(
      flatMap(
        ops.map(op => {
          log.debug(`Updating new columns in ${op.dest}`);
          return op.data.map(d => {
            return trx
              .withSchema(schema)
              .table(op.dest)
              .where({ id: op.reverse ? d.B : d.A })
              .update({ [op.col]: op.reverse ? d.A : d.B });
          });
        })
      )
    );
  });
}

export async function down() {}
