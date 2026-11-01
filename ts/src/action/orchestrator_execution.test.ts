import { WriteOperation } from "./action";
import { EntChangeset } from "./orchestrator";
import { Transaction } from "./transaction";
import { DataOperation } from "./operations";
import { Data, ID } from "../core/base";
import * as clause from "../core/clause";
import DB, { Dialect } from "../core/db";
import { loadRow } from "../core/ent";
import {
  AlwaysAllowPrivacyPolicy,
  AlwaysDenyPrivacyPolicy,
} from "../core/privacy";
import { LoggedOutViewer } from "../core/viewer";
import { SQLStatementOperation, StringType, UUIDType } from "../schema";
import {
  User,
  SimpleAction,
  getBuilderSchemaFromFields,
} from "../testutils/builder";
import {
  getSchemaTable,
  setupSqlite,
  setupPostgres,
} from "../testutils/db/temp_db";

const viewer = new LoggedOutViewer();
const schema = getBuilderSchemaFromFields(
  {
    name: StringType({ unique: true }),
    peer_id: UUIDType({ nullable: true }),
    note: StringType({ nullable: true }),
  },
  User,
);
const create = (name: string, fields: Data = {}) =>
  new SimpleAction(
    viewer,
    schema,
    new Map(Object.entries({ name, ...fields })),
    WriteOperation.Insert,
    null,
  );
const row = (name: string) =>
  loadRow({
    tableName: "users",
    fields: ["*"],
    clause: clause.Eq("name", name),
  });
const getID = (action: SimpleAction<User>) =>
  action.builder.orchestrator.getEntID();
const failWrite = (action: SimpleAction<User>): DataOperation<User> => ({
  builder: action.builder,
  performWriteSync: () => {
    throw new Error("write failed");
  },
  performWrite: async () => {
    throw new Error("write failed");
  },
});

for (const dialect of [Dialect.SQLite, Dialect.Postgres]) {
  describe(dialect, () => {
    const tables = () => [getSchemaTable(schema, dialect)];
    if (dialect === Dialect.SQLite) {
      setupSqlite("sqlite:///orchestrator-execution-test.db", tables);
    } else {
      setupPostgres(tables);
    }

    test("throwing rollback hooks cannot retain a rolled-back saved ID", async () => {
      const target = await create("collision", { note: "before" }).saveX();
      const action = create("collision", { note: "after" });
      action.builder.orchestrator.setOnConflictOptions({
        onConflictCols: ["name"],
        updateCols: ["note"],
      });
      const changeset = (await action.changeset()) as EntChangeset<User>;
      const planned = await getID(action);
      expect(planned).not.toBe(target.id);
      changeset.operations.unshift({
        builder: action.builder,
        performWrite: async () => {},
        performWriteSync: () => {},
        onRollback: () => {
          throw new Error("rollback hook failed");
        },
      });
      changeset.operations.push(failWrite(action));
      await expect(changeset.executor().execute()).rejects.toThrow(
        "write failed",
      );
      expect(await getID(action)).toBe(planned);
      expect((await row("collision"))!.note).toBe("before");
      // The database can still accept another write after cleanup.
      await expect(create("after rollback").saveX()).resolves.toBeDefined();
    });

    test.each([
      false,
      true,
    ])("rollback restores planned IDs across dependencies (nested=%s)", async (nested) => {
      await create("collision").saveX();
      const first = create("shared");
      const upsert = create("shared", { peer_id: first.builder });
      upsert.builder.orchestrator.setOnConflictOptions({
        onConflictCols: ["name"],
      });
      const bad = create("collision", { peer_id: upsert.builder });
      const planned = await getID(upsert);
      if (nested) {
        const parent = create("parent");
        parent.getTriggers = () => [
          {
            changeset: () =>
              Promise.all([
                first.changeset(),
                upsert.changesetWithOptions_BETA({
                  conditionalBuilder: parent.builder,
                }),
                bad.changeset(),
              ]),
          },
        ];
        await expect(parent.saveX()).rejects.toMatchObject({
          message: expect.stringMatching(/unique|duplicate/i),
        });
        expect(await row("parent")).toBeNull();
      } else {
        await expect(
          new Transaction(viewer, [first, upsert, bad]).run(),
        ).rejects.toMatchObject({
          message: expect.stringMatching(/unique|duplicate/i),
        });
      }
      expect(await row("shared")).toBeNull();
      expect(await getID(upsert)).toBe(planned);
      expect(await getID(upsert)).not.toBe(await getID(first));
    });

    test.each(
      [WriteOperation.Insert, WriteOperation.Edit].flatMap((operation) =>
        [false, true].map((update) => ({ operation, update })),
      ),
    )("standalone $operation upsert rolls back its ID and can retry (update=$update)", async ({
      operation,
      update,
    }) => {
      const target = await create("collision", { note: "before" }).saveX();
      const original =
        operation === WriteOperation.Edit
          ? await create("original").saveX()
          : null;
      const action = new SimpleAction(
        viewer,
        schema,
        new Map([
          ["name", "collision"],
          ["note", "after"],
        ]),
        operation,
        original,
      );
      if (original) {
        Object.assign(action, {
          transformWrite: () => ({ op: SQLStatementOperation.Insert }),
        });
      }
      action.builder.orchestrator.setOnConflictOptions({
        onConflictCols: ["name"],
        updateCols: update ? ["note"] : undefined,
      });
      const observed: ID[] = [];
      action.getObservers = () => [
        {
          observe: async () => {
            observed.push(await getID(action));
          },
        },
      ];
      const changeset = (await action.changeset()) as EntChangeset<User>;
      const planned = await getID(action);
      expect(planned).not.toBe(target.id);
      changeset.operations.push(failWrite(action));
      await expect(changeset.executor().execute()).rejects.toThrow(
        "write failed",
      );
      expect(await getID(action)).toBe(planned);
      expect((await row("collision"))!.note).toBe("before");
      expect(observed).toEqual([]);
      await action.builder.saveX();
      expect(await getID(action)).toBe(target.id);
      expect(observed).toEqual([target.id]);
      expect((await row("collision"))!.note).toBe(update ? "after" : "before");
    });

    test.each([
      "postFetch",
      "release",
      "entity privacy",
    ])("a committed ID survives %s failure", async (failure) => {
      const target = await create("collision", { note: "before" }).saveX();
      const action = create("collision", { note: "after" });
      action.builder.orchestrator.setOnConflictOptions({
        onConflictCols: ["name"],
        updateCols: ["note"],
      });
      if (failure === "postFetch") {
        const changeset = (await action.changeset()) as EntChangeset<User>;
        changeset.operations.push({
          builder: action.builder,
          performWrite: async () => {},
          performWriteSync: () => {},
          postFetch: async () => {
            throw new Error("postFetch failed");
          },
        });
        await expect(changeset.executor().execute()).rejects.toThrow(
          "postFetch failed",
        );
      } else if (failure === "release") {
        const db = DB.getInstance();
        const getClient = db.getNewClient.bind(db);
        let restoreRelease: (() => void) | undefined;
        const clientSpy = jest
          .spyOn(db, "getNewClient")
          .mockImplementationOnce(async () => {
            const client = await getClient();
            const release = client.release.bind(client);
            restoreRelease = () => {
              client.release = release;
            };
            let released = false;
            client.release = (error) => {
              if (!released) {
                released = true;
                release(error);
                throw new Error("release failed");
              }
            };
            return client;
          });
        try {
          await expect(action.saveX()).rejects.toThrow("release failed");
        } finally {
          restoreRelease?.();
          clientSpy.mockRestore();
        }
      } else {
        const policy = jest
          .spyOn(User.prototype, "getPrivacyPolicy")
          .mockReturnValue(AlwaysDenyPrivacyPolicy);
        try {
          await expect(action.saveX()).rejects.toThrow(
            "was able to create ent but not load it",
          );
        } finally {
          policy.mockRestore();
        }
      }
      expect(await getID(action)).toBe(target.id);
      expect((await row("collision"))!.note).toBe("after");
    });

    if (dialect === Dialect.Postgres) {
      test("rollback errors still invalidate the resolved ID", async () => {
        await create("collision").saveX();
        const action = create("collision");
        action.builder.orchestrator.setOnConflictOptions({
          onConflictCols: ["name"],
        });
        const changeset = (await action.changeset()) as EntChangeset<User>;
        const planned = await getID(action);
        changeset.operations.push(failWrite(action));
        const db = DB.getInstance();
        const getClient = db.getNewClient.bind(db);
        let cleanup: (() => void) | undefined;
        const clientSpy = jest
          .spyOn(db, "getNewClient")
          .mockImplementationOnce(async () => {
            const client = await getClient();
            const release = client.release.bind(client);
            let released = false;
            client.release = (error) => {
              if (!released) {
                released = true;
                release(error);
              }
            };
            cleanup = () => client.release();
            const query = client.query.bind(client);
            client.query = async (sql, values) => {
              const result = await query(sql, values);
              if (sql === "ROLLBACK") {
                throw new Error("rollback failed");
              }
              return result;
            };
            return client;
          });
        try {
          await expect(changeset.executor().execute()).rejects.toThrow(
            /failed/,
          );
          expect(await getID(action)).toBe(planned);
        } finally {
          cleanup?.();
          clientSpy.mockRestore();
        }
      });
    }

    test.each(
      [WriteOperation.Edit, WriteOperation.Delete].flatMap((operation) =>
        [false, true].map((transaction) => ({ operation, transaction })),
      ),
    )("silent $operation denial excludes its subtree and permits retry (transaction=$transaction)", async ({
      operation,
      transaction,
    }) => {
      const original = await create("original").saveX();
      const grandchild = create("grandchild");
      const child = create("child", { peer_id: grandchild.builder });
      child.getTriggers = () => [{ changeset: () => grandchild.changeset() }];
      const childObserve = jest.fn();
      const grandchildObserve = jest.fn();
      child.getObservers = () => [{ observe: childObserve }];
      grandchild.getObservers = () => [{ observe: grandchildObserve }];
      let allowed = false;
      const action = new SimpleAction(
        viewer,
        schema,
        new Map<string, any>([
          ["name", "replacement"],
          ["peer_id", child.builder],
        ]),
        operation,
        original,
      );
      const transform = jest.fn(() => ({
        op: SQLStatementOperation.Insert,
        changeset: () => child.changeset(),
      }));
      Object.assign(action, {
        transformWrite: transform,
        getPrivacyPolicy: () =>
          allowed ? AlwaysAllowPrivacyPolicy : AlwaysDenyPrivacyPolicy,
        __failPrivacySilently: () => true,
      });
      if (transaction) {
        await new Transaction(viewer, [action, create("independent")]).run();
        expect(await row("independent")).not.toBeNull();
      } else {
        await action.builder.saveX();
      }
      expect((await action.editedEntX()).id).toBe(original.id);
      expect(await getID(action)).toBe(original.id);
      expect(await row("child")).toBeNull();
      expect(await row("grandchild")).toBeNull();
      expect(childObserve).not.toHaveBeenCalled();
      expect(grandchildObserve).not.toHaveBeenCalled();
      allowed = true;
      await action.builder.saveX();
      const saved = await action.editedEntX();
      expect(saved.id).not.toBe(original.id);
      expect(await getID(action)).toBe(saved.id);
      expect(saved.data.peer_id).toBe((await row("child"))!.id);
      expect((await row("child"))!.peer_id).toBe((await row("grandchild"))!.id);
      expect(childObserve).toHaveBeenCalledTimes(1);
      expect(grandchildObserve).toHaveBeenCalledTimes(1);
      expect(transform).toHaveBeenCalledTimes(1);
      expect((await row("original"))!.id).toBe(original.id);
    });

    test("denied transaction members omit previously prepared dependencies", async () => {
      const original = await create("original").saveX();
      const child = create("child");
      let allowed = true;
      const action = new SimpleAction(
        viewer,
        schema,
        new Map<string, any>([
          ["name", "replacement"],
          ["peer_id", child.builder],
        ]),
        WriteOperation.Edit,
        original,
      );
      Object.assign(action, {
        transformWrite: () => ({
          op: SQLStatementOperation.Insert,
          changeset: () => child.changeset(),
        }),
        getPrivacyPolicy: () =>
          allowed ? AlwaysAllowPrivacyPolicy : AlwaysDenyPrivacyPolicy,
        __failPrivacySilently: () => true,
      });
      await action.changeset();
      allowed = false;
      await new Transaction(viewer, [action, create("independent")]).run();
      expect(await row("child")).toBeNull();
      expect(await row("replacement")).toBeNull();
      expect(await row("independent")).not.toBeNull();
      expect(await getID(action)).toBe(original.id);
    });
  });
}
