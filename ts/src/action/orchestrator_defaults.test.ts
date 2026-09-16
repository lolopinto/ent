import { advanceTo, clear } from "jest-date-mock";
import { WriteOperation } from "./action";
import { Data } from "../core/base";
import DB, { Dialect, Sqlite } from "../core/db";
import { LoggedOutViewer } from "../core/viewer";
import { StringType, SQLStatementOperation } from "../schema";
import {
  Contact,
  SimpleAction,
  getBuilderSchemaFromFields,
  getBuilderSchemaTZFromFields,
} from "../testutils/builder";
import { getSchemaTable, setupSqlite } from "../testutils/db/temp_db";

for (const [pattern, makeSchema] of [
  ["Node", getBuilderSchemaFromFields],
  ["NodeWithTZ", getBuilderSchemaTZFromFields],
] as const) {
  describe(pattern, () => {
    const schema = makeSchema(
      {
        name: StringType(),
        derived: StringType({
          disableUserEditable: true,
          defaultValueOnCreate: () => "created",
          defaultValueOnEdit: () => "edited",
        }),
        conditional: StringType({
          disableUserEditable: true,
          defaultValueOnCreate: () => "created",
          defaultValueOnEdit: () => "edited",
          onlyUpdateIfOtherFieldsBeingSet_BETA: true,
        }),
      },
      Contact,
    );
    setupSqlite(`sqlite:///orchestrator-defaults-${pattern}.db`, () => [
      getSchemaTable(schema, Dialect.SQLite),
    ]);
    const viewer = new LoggedOutViewer();
    const action = (input: Data, ent: Contact | null = null) =>
      new SimpleAction(
        viewer,
        schema,
        new Map(Object.entries(input)),
        ent ? WriteOperation.Edit : WriteOperation.Insert,
        ent,
      );
    let ent: Contact;
    beforeEach(async () => {
      advanceTo(new Date("2026-01-01T00:00:00Z"));
      ent = await action({ name: "original" }).saveX();
      // A database trigger detects even writes that happen to preserve values.
      const client = DB.getInstance().getConnection() as Sqlite;
      client.execSync("CREATE TABLE IF NOT EXISTS update_counts (id TEXT)");
      client.execSync("DELETE FROM update_counts");
      client.execSync(`CREATE TRIGGER IF NOT EXISTS count_updates AFTER UPDATE ON contacts
        BEGIN INSERT INTO update_counts (id) VALUES (NEW.id); END`);
      advanceTo(new Date("2026-01-02T00:00:00Z"));
    });
    afterEach(() => clear());
    const updates = async () => {
      const client = await DB.getInstance().getNewClient();
      return (await client.queryAll("SELECT * FROM update_counts")).rows.length;
    };

    test.each([
      false,
      true,
    ])("no-op edit, initially populated: %s", async (populated) => {
      const edit = action(populated ? { name: "ignored" } : {}, ent);
      edit.getTriggers = () => [
        {
          changeset: (builder) => {
            expect(builder.getInput().derived).toBe("edited");
            expect(builder.getInput().updatedAt).toEqual(new Date());
            builder.fields.delete("name");
          },
        },
      ];
      const saved = await edit.saveX();
      expect(saved.data).toEqual(ent.data);
      expect(await updates()).toBe(0);
    });

    test("a real edit persists its defaults", async () => {
      const saved = await action({ name: "changed" }, ent).saveX();
      expect(saved.data).toMatchObject({
        name: "changed",
        derived: "edited",
        conditional: "edited",
      });
      expect(saved.data.updated_at).toEqual(new Date());
      expect(await updates()).toBe(1);
    });

    test.each([
      "edited",
      "override",
      null,
      undefined,
    ])("explicit trigger assignment: %s", async (value) => {
      const edit = action({ name: "ignored" }, ent);
      edit.getTriggers = () => [
        {
          changeset: (builder) => {
            builder.fields.delete("name");
            builder.updateInput({ derived: value });
          },
        },
      ];
      if (value === null) {
        await expect(edit.saveX()).rejects.toThrow(
          "set to null for non-nullable field",
        );
        expect(await updates()).toBe(0);
      } else {
        const saved = await edit.saveX();
        expect(saved.data.derived).toBe(value ?? "created");
        expect(await updates()).toBe(value === undefined ? 0 : 1);
      }
    });

    test("constructor assignment equal to a default is still an edit", async () => {
      const saved = await action({ derived: "edited" }, ent).saveX();
      expect(saved.data.derived).toBe("edited");
      expect(await updates()).toBe(1);
    });

    test("transformed data is explicit even when accompanied by defaults", async () => {
      const edit = action({}, ent);
      Object.assign(edit, {
        transformWrite: () => ({
          op: SQLStatementOperation.Update,
          data: { name: "transformed" },
        }),
      });
      const saved = await edit.saveX();
      expect(saved.data.name).toBe("transformed");
      expect(saved.data.derived).toBe("edited");
      expect(await updates()).toBe(1);
    });

    test("a transform assigning only an internal defaulted field still writes", async () => {
      const edit = action({}, ent);
      Object.assign(edit, {
        transformWrite: () => ({
          op: SQLStatementOperation.Update,
          data: { derived: "transformed" },
        }),
      });
      const saved = await edit.saveX();
      expect(saved.data.derived).toBe("transformed");
      expect(await updates()).toBe(1);
    });

    test("immutable creation defaults survive ignored transform assignments", async () => {
      const field = schema.fields.derived;
      field.immutable = true;
      try {
        const create = action({ name: "new" });
        Object.assign(create, {
          transformWrite: () => ({
            op: SQLStatementOperation.Insert,
            data: { derived: "ignored" },
          }),
        });
        expect((await create.saveX()).data.derived).toBe("created");
      } finally {
        delete field.immutable;
      }
    });

    test.each([
      false,
      true,
    ])("full-data validators see persisted defaults, edit: %s", async (editing) => {
      const values: unknown[] = [];
      const field = schema.fields.derived;
      field.validateWithFullData = (value) => {
        values.push(value);
        return value === (editing ? "edited" : "created");
      };
      try {
        await action({ name: "validated" }, editing ? ent : null).saveX();
        expect(values).toEqual([editing ? "edited" : "created"]);
      } finally {
        delete field.validateWithFullData;
      }
    });

    test("an explicit timestamp assignment using the default object still writes", async () => {
      const edit = action({ name: "ignored" }, ent);
      await edit.builder.orchestrator.getEditedData();
      edit.getTriggers = () => [
        {
          changeset: (builder) => {
            builder.fields.delete("name");
            builder.updateInput({ updatedAt: builder.getInput().updatedAt });
          },
        },
      ];
      const saved = await edit.saveX();
      expect(saved.data.updated_at).toEqual(new Date());
      expect(await updates()).toBe(1);
    });
  });
}
