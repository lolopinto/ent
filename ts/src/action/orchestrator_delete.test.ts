import { WriteOperation } from "../action";
import * as clause from "../core/clause";
import DB, { Dialect, Sqlite } from "../core/db";
import { loadRow } from "../core/ent";
import { LoggedOutViewer } from "../core/viewer";
import {
  ConstraintType,
  SQLStatementOperation,
  StringType,
  UUIDType,
} from "../schema";
import {
  Contact,
  SimpleAction,
  User,
  getBuilderSchemaFromFields,
} from "../testutils/builder";
import {
  getSchemaTable,
  setupPostgres,
  setupSqlite,
} from "../testutils/db/temp_db";
import { randomEmail } from "../testutils/db/value";

const users = getBuilderSchemaFromFields(
  { name: StringType({ unique: true }) },
  User,
);
const contacts = getBuilderSchemaFromFields(
  { owner_id: UUIDType({ nullable: true }) },
  Contact,
  {
    constraints: [
      {
        name: "contact_owner_fk",
        columns: ["owner_id"],
        type: ConstraintType.ForeignKey,
        fkey: { tableName: "users", columns: ["id"] },
      },
    ],
  },
);
const viewer = new LoggedOutViewer();
const createUser = (name = randomEmail()) =>
  new SimpleAction(
    viewer,
    users,
    new Map([["name", name]]),
    WriteOperation.Insert,
    null,
  );

for (const dialect of [Dialect.SQLite, Dialect.Postgres]) {
  describe(dialect, () => {
    const tables = () => [
      getSchemaTable(users, dialect),
      getSchemaTable(contacts, dialect),
    ];
    // Each case uses distinct rows; retain them until DB teardown so cleanup
    // doesn't try to delete referenced parents before their children.
    const options = { disableDeleteAfterEachTest: true };
    if (dialect === Dialect.SQLite) {
      setupSqlite("sqlite:///orchestrator-delete-fk.db", tables, options);
      beforeEach(() => {
        (DB.getInstance().getConnection() as Sqlite).db.exec(
          "PRAGMA foreign_keys = ON",
        );
      });
    } else {
      setupPostgres(tables, options);
    }

    test.each(
      [false, true].flatMap((transform) =>
        ["unconditional", "conflict", "insert"].map((mode) => ({
          transform,
          mode,
        })),
      ),
    )("delete waits for nested FK cleanup (transform=$transform, mode=$mode)", async ({
      transform,
      mode,
    }) => {
      const victim = await createUser().saveX();
      const dependents = await Promise.all(
        [0, 1].map(() =>
          new SimpleAction(
            viewer,
            contacts,
            new Map([["owner_id", victim.id]]),
            WriteOperation.Insert,
            null,
          ).saveX(),
        ),
      );
      const deletion = new SimpleAction(
        viewer,
        users,
        new Map(),
        WriteOperation.Delete,
        victim,
      );
      if (transform) {
        Object.assign(deletion, {
          transformWrite: () => ({ op: SQLStatementOperation.Delete }),
        });
      }
      const [first, second] = dependents.map(
        (dependent) =>
          new SimpleAction(
            viewer,
            contacts,
            new Map([["owner_id", null]]),
            WriteOperation.Edit,
            dependent,
          ),
      );
      deletion.getTriggers = () => [
        {
          changeset: () =>
            first.changesetWithOptions_BETA({
              conditionalBuilder: deletion.builder,
            }),
        },
      ];
      first.getTriggers = () => [
        {
          changeset: () =>
            second.changesetWithOptions_BETA({
              conditionalBuilder: first.builder,
            }),
        },
      ];
      const parent = createUser();
      if (mode === "conflict") {
        await createUser(parent.builder.fields.get("name")).saveX();
      }
      parent.builder.orchestrator.setOnConflictOptions({
        onConflictCols: ["name"],
      });
      parent.getTriggers = () => [
        {
          changeset: () =>
            deletion.changesetWithOptions_BETA({
              conditionalBuilder: parent.builder,
            }),
        },
      ];
      const observe = jest.fn();
      for (const action of [parent, deletion, first, second]) {
        action.getObservers = () => [{ observe }];
      }
      if (mode === "unconditional") {
        await deletion.builder.saveX();
      } else {
        await parent.saveX();
      }
      const remaining = await loadRow({
        tableName: "users",
        fields: ["id"],
        clause: clause.Eq("id", victim.id),
      });
      expect(remaining).toEqual(mode === "conflict" ? { id: victim.id } : null);
      for (const dependent of dependents) {
        expect(
          await loadRow({
            tableName: "contacts",
            fields: ["owner_id"],
            clause: clause.Eq("id", dependent.id),
          }),
        ).toEqual({ owner_id: mode === "conflict" ? victim.id : null });
      }
      expect(observe).toHaveBeenCalledTimes(
        mode === "conflict" ? 0 : mode === "unconditional" ? 3 : 4,
      );
    });
  });
}
