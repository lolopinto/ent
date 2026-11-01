import { WriteOperation } from "./action";
import { ID } from "../core/base";
import { LoggedOutViewer } from "../core/viewer";
import { StringType, UUIDType, SQLStatementOperation } from "../schema";
import {
  SimpleAction,
  User,
  getBuilderSchemaFromFields,
} from "../testutils/builder";

const viewer = new LoggedOutViewer();
const existing = new User(viewer, { id: "original", first_name: "Old" });
const target = new User(viewer, { id: "target", first_name: "Target" });

test.each([
  WriteOperation.Edit,
  WriteOperation.Delete,
])("%s concurrent early IDs wait for an async insert transformation", async (operation) => {
  const schema = getBuilderSchemaFromFields({ FirstName: StringType() }, User);
  const action = new SimpleAction(
    viewer,
    schema,
    new Map([["FirstName", "New"]]),
    operation,
    existing,
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  Object.assign(action, {
    transformWrite: async () => {
      await gate;
      return { op: SQLStatementOperation.Insert };
    },
  });
  const first = action.builder.orchestrator.getEntID();
  const second = action.builder.orchestrator.getEntID();
  release();
  const ids = await Promise.all([first, second]);
  expect(ids[0]).not.toBe(existing.id);
  expect(ids[1]).toBe(ids[0]);
  await action.validX();
  expect(await action.builder.orchestrator.getEntID()).toBe(ids[0]);
});

test.each([
  [WriteOperation.Edit, existing, null, existing.id],
  [WriteOperation.Insert, null, target, target.id],
  [WriteOperation.Edit, existing, target, target.id],
] as const)("%s ID resolves ordinary or transformed update targets", async (operation, source, transformed, expected) => {
  const action = new SimpleAction(
    viewer,
    getBuilderSchemaFromFields({ FirstName: StringType() }, User),
    new Map([["FirstName", "New"]]),
    operation,
    source,
  );
  const hookIDs: ID[] = [];
  Object.assign(action, {
    transformWrite: () =>
      transformed
        ? { op: SQLStatementOperation.Update, existingEnt: transformed }
        : null,
    getTriggers: () => [
      {
        changeset: async () => {
          hookIDs.push(await action.builder.orchestrator.getEntID());
        },
      },
    ],
  });
  expect(await action.builder.orchestrator.getEntID()).toBe(expected);
  await action.validX();
  expect(hookIDs).toEqual([expected]);
});

test("edit defaults can read an existing write target without waiting on themselves", async () => {
  let readID!: () => Promise<ID>;
  const schema = getBuilderSchemaFromFields(
    { FirstName: StringType({ defaultValueOnEdit: () => readID() }) },
    User,
  );
  const action = new SimpleAction(
    viewer,
    schema,
    new Map(),
    WriteOperation.Edit,
    existing,
  );
  readID = () => action.builder.orchestrator.getEntID();
  const id = await readID();
  expect(id).toBe(existing.id);
  expect((await action.builder.orchestrator.getEditedData()).first_name).toBe(
    id,
  );
});

test("an ID read from its own transformation rejects instead of deadlocking", async () => {
  const action = new SimpleAction(
    viewer,
    getBuilderSchemaFromFields({ FirstName: StringType() }, User),
    new Map([["FirstName", "New"]]),
    WriteOperation.Edit,
    existing,
  );
  Object.assign(action, {
    transformWrite: async () => {
      await action.builder.orchestrator.getEntID();
      return { op: SQLStatementOperation.Insert };
    },
  });
  await expect(action.builder.orchestrator.getEntID()).rejects.toThrow(
    /during transformWrite/,
  );
});

test("an ID default cannot wait for its own unresolved value", async () => {
  let readID!: () => Promise<ID>;
  const schema = getBuilderSchemaFromFields(
    {
      id: UUIDType({ primaryKey: true, defaultValueOnCreate: () => readID() }),
      FirstName: StringType(),
    },
    User,
  );
  schema.patterns = [];
  const action = new SimpleAction(
    viewer,
    schema,
    new Map([["FirstName", "New"]]),
    WriteOperation.Insert,
    null,
  );
  readID = () => action.builder.orchestrator.getEntID();
  await expect(readID()).rejects.toThrow(/from its own defaults/);
});
