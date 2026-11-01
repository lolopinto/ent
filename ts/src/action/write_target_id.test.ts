import { Builder, getExistingEntForWrite, WriteOperation } from "./index";
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
])("%s early IDs leave async insert transformations until validation", async (operation) => {
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
  const transformWrite = jest.fn(async () => {
    await gate;
    return { op: SQLStatementOperation.Insert };
  });
  Object.assign(action, { transformWrite });
  const first = action.builder.orchestrator.getEntID();
  const second = action.builder.orchestrator.getEntID();
  expect(await Promise.all([first, second])).toEqual([
    existing.id,
    existing.id,
  ]);
  expect(transformWrite).not.toHaveBeenCalled();
  const validation = action.validX();
  release();
  await validation;
  expect(transformWrite).toHaveBeenCalledTimes(1);
  expect(await action.builder.orchestrator.getEntID()).not.toBe(existing.id);
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
  expect(await action.builder.orchestrator.getEntID()).toBe(
    source?.id ?? expected,
  );
  await action.validX();
  expect(await action.builder.orchestrator.getEntID()).toBe(expected);
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
  await action.validX();
  expect((await action.builder.orchestrator.getEditedData()).first_name).toBe(
    id,
  );
});

test("an edit transform can read its current target ID without initializing fields again", async () => {
  const action = new SimpleAction(
    viewer,
    getBuilderSchemaFromFields({ FirstName: StringType() }, User),
    new Map([["FirstName", "New"]]),
    WriteOperation.Edit,
    existing,
  );
  Object.assign(action, {
    transformWrite: async () => {
      expect(await action.builder.orchestrator.getEntID()).toBe(existing.id);
      return { op: SQLStatementOperation.Insert };
    },
  });
  await action.validX();
  expect(await action.builder.orchestrator.getEntID()).not.toBe(existing.id);
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
  await expect(readID()).rejects.toThrow(/circular.*dependency/);
});

test("reading an existing ID does not run transforms, defaults, or field collection", async () => {
  const defaultValueOnEdit = jest.fn(() => "default");
  const action = new SimpleAction(
    viewer,
    getBuilderSchemaFromFields(
      {
        FirstName: StringType({ defaultValueOnEdit }),
      },
      User,
    ),
    new Map(),
    WriteOperation.Edit,
    existing,
  );
  const transformWrite = jest.fn(() => null);
  Object.assign(action, { transformWrite });
  const options = action.builder.orchestrator.__getOptions();
  const editedFields = jest.spyOn(options, "editedFields");
  expect(await action.builder.orchestrator.getEntID()).toBe(existing.id);
  expect(transformWrite).not.toHaveBeenCalled();
  expect(defaultValueOnEdit).not.toHaveBeenCalled();
  expect(editedFields).not.toHaveBeenCalled();
});

test("an ID dependency cycle between creation defaults rejects instead of hanging", async () => {
  let first: SimpleAction<User>;
  let second: SimpleAction<User>;
  const make = (read: () => Promise<ID>) => {
    const schema = getBuilderSchemaFromFields(
      {
        id: UUIDType({ primaryKey: true, defaultValueOnCreate: read }),
        FirstName: StringType(),
      },
      User,
    );
    schema.patterns = [];
    return new SimpleAction(
      viewer,
      schema,
      new Map([["FirstName", "New"]]),
      WriteOperation.Insert,
      null,
    );
  };
  first = make(() => second.builder.orchestrator.getEntID());
  second = make(() => first.builder.orchestrator.getEntID());
  await expect(first.builder.orchestrator.getEntID()).rejects.toThrow(
    /circular.*dependency/,
  );
});

test("the public write-target helper supports current and legacy Builder interfaces", async () => {
  const action = new SimpleAction(
    viewer,
    getBuilderSchemaFromFields({ FirstName: StringType() }, User),
    new Map([["FirstName", "New"]]),
    WriteOperation.Edit,
    existing,
  );
  Object.assign(action, {
    transformWrite: () => ({ op: SQLStatementOperation.Insert }),
  });
  const builder: Builder<User> = action.builder;
  expect(getExistingEntForWrite(builder)).toBe(existing);
  await action.validX();
  expect(getExistingEntForWrite(builder)).toBeNull();
  const legacy: Builder<User> = Object.assign(Object.create(builder), {
    orchestrator: {
      __getOptions: () => action.builder.orchestrator.__getOptions(),
    },
  });
  expect(getExistingEntForWrite(legacy)).toBe(existing);
});
