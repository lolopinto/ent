import assert from "node:assert/strict";
import { verifyOwnership } from "./ownership_review_test";
import { graphql, GraphQLInputObjectType } from "graphql";
import { LoggedOutViewer } from "@snowtop/ent";
import type { ID } from "@snowtop/ent";
import DB from "@snowtop/ent/core/db";
import { loadConfig } from "@snowtop/ent/core/config";
import { Contact } from "./ent";
import CreateContactAction, {
  ContactCreateInput,
} from "./ent/contact/actions/create_contact_action";
import EditContactAction, {
  ContactEditInput,
} from "./ent/contact/actions/edit_contact_action";
import { CreateContactActionBase } from "./ent/generated/contact/actions/create_contact_action_base";
import { EditContactActionBase } from "./ent/generated/contact/actions/edit_contact_action_base";
import schema from "./graphql/generated/schema";
import { verifyInternalRelationships } from "./internal_relationships_test";

type InternalField =
  | "normalizedName"
  | "internalToken"
  | "primaryEmail"
  | "auditLabel"
  | "serverLabel"
  | "dbOnlyNote";
type Assert<T extends true> = T;
type CreateInputProtection = Assert<
  Extract<keyof ContactCreateInput, InternalField> extends never ? true : false
>;
type EditInputProtection = Assert<
  Extract<keyof ContactEditInput, InternalField> extends never ? true : false
>;

const reload = (id: ID) => Contact.loadX(new LoggedOutViewer(), id);

async function main() {
  loadConfig({ dbConnectionString: process.env.DB_CONNECTION_STRING });
  const db = DB.getInstance();
  const client = await db.getNewClient();
  try {
    await client.query(`CREATE TABLE contacts (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      name TEXT NOT NULL, email TEXT, normalized_name TEXT NOT NULL, internal_token TEXT,
      primary_email TEXT, audit_label TEXT NOT NULL,
      server_label TEXT NOT NULL DEFAULT 'from-db',
      db_only_note TEXT NOT NULL DEFAULT 'db-only'
    )`);

    // Public TS input contracts above and generated GraphQL inputs stay closed.
    for (const name of ["ContactCreateInput", "ContactEditInput"]) {
      const input = schema.getType(name) as GraphQLInputObjectType;
      assert(input instanceof GraphQLInputObjectType);
      for (const field of [
        "normalizedName",
        "internalToken",
        "primaryEmail",
        "auditLabel",
        "serverLabel",
        "dbOnlyNote",
      ]) {
        assert.equal(
          input.getFields()[field],
          undefined,
          `${name}.${field} exposed`,
        );
      }
    }
    for (const [mutation, inputType, input] of [
      [
        "contactCreate",
        "ContactCreateInput",
        { name: "forged", primaryEmail: "forged@example.com" },
      ],
      [
        "contactEdit",
        "ContactEditInput",
        { id: "unused", primaryEmail: "forged@example.com" },
      ],
    ] as const) {
      const result = await graphql({
        schema,
        source: `mutation($input: ${inputType}!) { ${mutation}(input: $input) { contact { id } } }`,
        variableValues: { input },
      });
      assert(
        result.errors?.some((error) =>
          error.message.includes('Field "primaryEmail" is not defined'),
        ),
      );
    }
    console.log("PASS: generated TS and GraphQL public input protection");

    const viewer = new LoggedOutViewer();
    // Seed an existing row independently of INSERT so a missing required derived
    // field on create cannot mask silently dropped nullable updates on edit.
    const seededID = "66635c36-2b24-4b88-a81c-98e91db8c33b";
    await client.query(
      `INSERT INTO contacts (id, created_at, updated_at, name, normalized_name,
        email, primary_email, audit_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        seededID,
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
        "Seeded",
        "seeded",
        "before@example.com",
        "before@example.com",
        "created",
      ],
    );
    await EditContactAction.create(viewer, await reload(seededID), {
      email: " AFTER@EXAMPLE.COM ",
    }).saveX();
    assert.equal((await reload(seededID)).primaryEmail, "after@example.com");
    console.log(
      "PASS: nullable EDIT trigger replaces a previously stored value",
    );

    const created = await CreateContactAction.create(viewer, {
      name: "  ADA  ",
      email: " ADA@EXAMPLE.COM ",
    }).saveX();
    let contact = await reload(created.id);
    assert.equal(contact.normalizedName, "ada");
    assert.equal(contact.internalToken, "default-token");
    assert.equal(contact.primaryEmail, "ada@example.com");
    assert.equal(contact.auditLabel, "created");
    assert.equal(contact.serverLabel, "from-db");
    assert(contact.createdAt instanceof Date);
    console.log(
      "PASS: INSERT trigger-only required field and override of default persist after reload",
    );

    await EditContactAction.create(viewer, contact, {
      name: " GRACE ",
      email: " GRACE@EXAMPLE.COM ",
    }).saveX();
    contact = await reload(contact.id);
    assert.equal(contact.normalizedName, "grace");
    assert.equal(contact.internalToken, created.internalToken);
    assert.equal(contact.primaryEmail, "grace@example.com");
    assert.equal(contact.auditLabel, "edited");
    await EditContactAction.create(viewer, contact, { email: null }).saveX();
    contact = await reload(contact.id);
    assert.equal(contact.primaryEmail, null);
    console.log(
      "PASS: EDIT trigger values and explicit null persist after reload",
    );

    const nullContact = await CreateContactAction.create(viewer, {
      name: "Null",
      email: null,
    }).saveX();
    assert.equal((await reload(nullContact.id)).primaryEmail, null);
    const defaultContact = await CreateContactAction.create(viewer, {
      name: "Default",
    }).saveX();
    let defaults = await reload(defaultContact.id);
    assert.equal(defaults.primaryEmail, "default@example.com");
    const originalUpdatedAt = defaults.updatedAt.getTime();
    await EditContactAction.create(viewer, defaults, {}).saveX();
    defaults = await reload(defaults.id);
    assert.equal(defaults.auditLabel, "created");
    assert.equal(defaults.updatedAt.getTime(), originalUpdatedAt);
    console.log(
      "PASS: nullable INSERT, untouched defaults, and no-op EDIT preserve default behavior",
    );

    // Exercise internal updates independently of the custom action triggers.
    const internal = new CreateContactActionBase(viewer, { name: "Internal" });
    internal.builder.overrideInternalToken("create-token");
    internal.builder.updateInput({
      normalizedName: "internal",
      primaryEmail: "internal@example.com",
      auditLabel: "internal-create",
      dbOnlyNote: "ignored",
    });
    const internalEnt = await internal.saveX();
    contact = await reload(internalEnt.id);
    assert.equal(contact.primaryEmail, "internal@example.com");
    assert.equal(contact.auditLabel, "internal-create");
    assert.equal(contact.internalToken, "create-token");
    const edit = new EditContactActionBase(viewer, contact, {});
    assert.throws(
      () => edit.builder.updateInput({ internalToken: "forged" }),
      /overrideInternalToken/,
    );
    edit.builder.overrideInternalToken("edit-token");
    edit.builder.updateInput({
      primaryEmail: null,
      auditLabel: "internal-edit",
      dbOnlyNote: "ignored",
    });
    await edit.saveX();
    contact = await reload(contact.id);
    assert.equal(contact.primaryEmail, null);
    assert.equal(contact.auditLabel, "internal-edit");
    assert.equal(contact.internalToken, "edit-token");
    console.log(
      "PASS: typed immutable internal overrides persist; ordinary updates remain guarded",
    );
    const row = await client.query(
      "SELECT db_only_note, server_label FROM contacts WHERE id = ?",
      [contact.id],
    );
    assert.equal(row.rows[0].db_only_note, "db-only");
    assert.equal(row.rows[0].server_label, "from-db");
    console.log(
      "PASS: internal INSERT/EDIT assignments persist; dbOnly and untouched server defaults remain DB-owned",
    );
    await verifyInternalRelationships(
      client,
      seededID,
      created.id,
      internalEnt.id,
    );
    await verifyOwnership(client, seededID, created.id, internalEnt.id);
  } finally {
    client.release();
    await db.endPool();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
