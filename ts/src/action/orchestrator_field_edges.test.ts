import { Data, ID, Viewer } from "../core/base";
import { Dialect } from "../core/db";
import { convertNullableList } from "../core/convert";
import { loadRow, loadRows } from "../core/ent";
import * as clause from "../core/clause";
import { IDViewer } from "../core/viewer";
import {
  SQLStatementOperation,
  StringType,
  UUIDListType,
  UUIDType,
} from "../schema";
import {
  BaseEnt,
  Contact,
  getBuilderSchemaFromFields,
  SimpleAction,
} from "../testutils/builder";
import {
  assoc_edge_config_table,
  assoc_edge_table,
  getSchemaTable,
  setupSqlite,
} from "../testutils/db/temp_db";
import { createRowForTest } from "../testutils/write";
import { WriteOperation } from "./action";

class Assignment extends BaseEnt {
  nodeType = "Assignment";
}

const ownerEdge = "owner-edge";
const defaultEdge = "default-edge";
const memberEdge = "member-edge";
const bindings = [
  { field: "owner_id", edge: ownerEdge },
  { field: "second_owner_id", edge: ownerEdge },
  { field: "default_owner_id", edge: defaultEdge, defaults: true },
  { field: "member_ids", edge: memberEdge, list: true },
];
const contactSchema = getBuilderSchemaFromFields(
  { name: StringType() },
  Contact,
);
const assignmentSchema = getBuilderSchemaFromFields(
  {
    name: StringType(),
    owner_id: UUIDType({ nullable: true, disableUserEditable: true }),
    second_owner_id: UUIDType({ nullable: true, disableUserEditable: true }),
    default_owner_id: UUIDType({
      nullable: true,
      disableUserEditable: true,
      defaultToViewerOnCreate: true,
      defaultValueOnEdit: (builder) => builder.viewer.viewerID,
    }),
    member_ids: UUIDListType({ nullable: true, disableUserEditable: true }),
  },
  Assignment,
);

let a: Contact;
let b: Contact;
let c: Contact;
let viewer: Viewer;
const ids = (value: any) =>
  value === undefined
    ? undefined
    : value === null
      ? []
      : Array.isArray(value)
        ? value
        : [value];

// Supply the metadata/callback contract of generated builders. All reconciliation,
// defaults, transforms, dependency resolution and SQL use the real Orchestrator.
// Generated field selection and private/list normalization stay in the Go fixture.
class FieldAction extends SimpleAction<Assignment> {
  constructor(
    input: Data,
    existing: Assignment | null = null,
    operation = existing ? WriteOperation.Edit : WriteOperation.Insert,
    actionViewer = viewer,
  ) {
    super(
      actionViewer,
      assignmentSchema,
      new Map(Object.entries(input)),
      operation,
      existing,
    );
    const builder = this.builder;
    const orchestrator = builder.orchestrator;
    const options = orchestrator.__getOptions();
    const editedFields = options.editedFields;
    options.editedFields = async () => {
      const fields = await editedFields();
      for (const binding of bindings) {
        const stored = builder.existingEnt?.data[binding.field];
        orchestrator.__setFieldEdges(
          binding.field,
          ids(fields.get(binding.field)),
          binding.edge,
          "Contact",
          {
            existingIDs: binding.list
              ? (convertNullableList<ID>(stored) ?? [])
              : (ids(stored) ?? []),
          },
        );
      }
      return fields;
    };
    const updateInput = builder.updateInput.bind(builder);
    builder.updateInput = (input) => {
      updateInput(input);
      for (const binding of bindings) {
        if (binding.defaults && input[binding.field] !== undefined) {
          orchestrator.__setFieldEdges(
            binding.field,
            ids(input[binding.field]),
            binding.edge,
            "Contact",
            {},
          );
        }
      }
    };
    options.updateInput = builder.updateInput.bind(builder);
  }
}

const create = (input: Data = {}, actionViewer = viewer) =>
  new FieldAction(
    { name: "assignment", ...input },
    null,
    WriteOperation.Insert,
    actionViewer,
  ).saveX();
const raw = (id: ID) =>
  loadRow({
    tableName: "assignments",
    fields: ["*"],
    clause: clause.Eq("id", id),
  });
const reload = async (ent: Assignment) =>
  new Assignment(viewer, (await raw(ent.id))!);
async function rows(ent: Assignment, edge = ownerEdge) {
  const values = await loadRows({
    tableName: "field_edges",
    fields: ["id1", "data"],
    clause: clause.And(clause.Eq("id2", ent.id), clause.Eq("edge_type", edge)),
  });
  return values.sort((x, y) => String(x.id1).localeCompare(String(y.id1)));
}
const expectedRows = (...owners: ID[]) =>
  owners
    .map((id1) => ({ id1, data: null }))
    .sort((x, y) => String(x.id1).localeCompare(String(y.id1)));
const queued = (action: FieldAction, op: WriteOperation, edge = ownerEdge) =>
  action.builder.orchestrator.getInputEdges(edge, op).map((value) => value.id);

setupSqlite("sqlite:///orchestrator-field-edges-test.db", () => [
  assoc_edge_config_table(),
  assoc_edge_table("field_edges"),
  getSchemaTable(contactSchema, Dialect.SQLite),
  getSchemaTable(assignmentSchema, Dialect.SQLite),
]);
beforeEach(async () => {
  for (const edge of [ownerEdge, defaultEdge, memberEdge]) {
    await createRowForTest({
      tableName: "assoc_edge_config",
      fields: {
        edge_type: edge,
        edge_name: edge,
        edge_table: "field_edges",
        symmetric_edge: false,
        inverse_edge_type: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  }
  const seedViewer = new IDViewer("seed");
  [a, b, c] = await Promise.all(
    ["a", "b", "c"].map((name) =>
      new SimpleAction(
        seedViewer,
        contactSchema,
        new Map([["name", name]]),
        WriteOperation.Insert,
        null,
      ).saveX(),
    ),
  );
  viewer = new IDViewer(a.id);
});

for (const field of ["owner_id", "member_ids"]) {
  const list = field === "member_ids";
  const edge = list ? memberEdge : ownerEdge;
  const value = (id: ID) => (list ? [id] : id);
  test(`${field}: triggers replace speculative values; omit, clear and delete reconcile stored rows`, async () => {
    const action = new FieldAction({ name: "created", [field]: value(a.id) });
    await action.builder.orchestrator.getEditedData();
    action.getTriggers = () => [
      {
        changeset: (builder) => {
          builder.updateInput({ [field]: value(b.id) });
        },
      },
    ];
    const ent = await action.saveX();
    expect(await rows(ent, edge)).toEqual(expectedRows(b.id));
    const stored = (await raw(ent.id))![field];
    expect(list ? convertNullableList(stored) : stored).toEqual(value(b.id));
    expect(queued(action, WriteOperation.Insert, edge)).toEqual([b.id]);
    const omitted = new FieldAction({ name: "unrelated" }, await reload(ent));
    await omitted.saveX();
    expect(await rows(ent, edge)).toEqual(expectedRows(b.id));
    expect(queued(omitted, WriteOperation.Delete, edge)).toEqual([]);
    const edit = new FieldAction({ [field]: value(a.id) }, await reload(ent));
    await edit.builder.orchestrator.getEditedData();
    edit.getTriggers = () => [
      {
        changeset: (builder) => {
          builder.updateInput({ [field]: value(b.id) });
        },
      },
    ];
    await edit.saveX();
    expect(await rows(ent, edge)).toEqual(expectedRows(b.id));
    expect(queued(edit, WriteOperation.Delete, edge)).toEqual([]);
    const clear = new FieldAction({ [field]: value(c.id) }, await reload(ent));
    await clear.builder.orchestrator.getEditedData();
    clear.getTriggers = () => [
      {
        changeset: (builder) => {
          builder.updateInput({ [field]: null });
        },
      },
    ];
    await clear.saveX();
    expect((await raw(ent.id))![field]).toBeNull();
    expect(await rows(ent, edge)).toEqual([]);
    await new FieldAction({ [field]: value(a.id) }, await reload(ent)).saveX();
    const remove = new FieldAction(
      {},
      await reload(ent),
      WriteOperation.Delete,
    );
    remove.getTriggers = () => [
      {
        changeset: (builder) => {
          builder.updateInput({ [field]: value(b.id) });
        },
      },
    ];
    await remove.builder.saveX();
    expect(await raw(ent.id)).toBeNull();
    expect(await rows(ent, edge)).toEqual([]);
    expect(queued(remove, WriteOperation.Insert, edge)).toEqual([]);
  });
}

test("list replacement and empty list remove only previous members", async () => {
  const ent = await create({ member_ids: [a.id, b.id] });
  await new FieldAction({ member_ids: [b.id, c.id] }, ent).saveX();
  expect(await rows(ent, memberEdge)).toEqual(expectedRows(b.id, c.id));
  await new FieldAction({ member_ids: [] }, await reload(ent)).saveX();
  expect(convertNullableList((await raw(ent.id))!.member_ids)).toEqual([]);
  expect(await rows(ent, memberEdge)).toEqual([]);
});

test("shared fields retain distinct and omitted sibling memberships", async () => {
  const ent = await create({ owner_id: a.id, second_owner_id: b.id });
  expect(await rows(ent)).toEqual(expectedRows(a.id, b.id));
  await new FieldAction({ owner_id: b.id }, ent).saveX();
  expect(await rows(ent)).toEqual(expectedRows(b.id));
  await new FieldAction({ owner_id: c.id }, await reload(ent)).saveX();
  expect(await rows(ent)).toEqual(expectedRows(b.id, c.id));
  await new FieldAction({ owner_id: null }, await reload(ent)).saveX();
  expect(await rows(ent)).toEqual(expectedRows(b.id));
  await new FieldAction(
    {},
    await reload(ent),
    WriteOperation.Delete,
  ).builder.saveX();
  expect(await rows(ent)).toEqual([]);
});

test("delete transformed to edit retracts generated removals before triggers", async () => {
  const ent = await create({ owner_id: a.id });
  const action = new FieldAction({}, ent, WriteOperation.Delete);
  action.builder.orchestrator.__getOptions().action!.transformWrite = () => ({
    op: SQLStatementOperation.Update,
    data: { name: "retained" },
  });
  action.getTriggers = () => [
    {
      changeset: () => {
        expect(queued(action, WriteOperation.Delete)).toEqual([]);
      },
    },
  ];
  await action.saveX();
  expect((await raw(ent.id))!.name).toBe("retained");
  expect(await rows(ent)).toEqual(expectedRows(a.id));
});

test("create transformed to edit refreshes stored memberships before defaults and triggers", async () => {
  const ent = await create({ default_owner_id: b.id });
  const action = new FieldAction({ name: "edited" });
  action.builder.orchestrator.__getOptions().action!.transformWrite = () => ({
    op: SQLStatementOperation.Update,
    existingEnt: ent,
  });
  action.getTriggers = () => [
    {
      changeset: () => {
        expect(queued(action, WriteOperation.Delete, defaultEdge)).toEqual([
          b.id,
        ]);
        expect(queued(action, WriteOperation.Insert, defaultEdge)).toEqual([
          a.id,
        ]);
      },
    },
  ];
  await action.saveX();
  expect((await raw(ent.id))!.default_owner_id).toBe(a.id);
  expect(await rows(ent, defaultEdge)).toEqual(expectedRows(a.id));
});

for (const field of ["owner_id", "member_ids", "default_owner_id"]) {
  test(`${field}: manual enrichment and unrelated operations survive collection`, async () => {
    const edge =
      field === "member_ids"
        ? memberEdge
        : field === "default_owner_id"
          ? defaultEdge
          : ownerEdge;
    const input =
      field === "default_owner_id"
        ? {}
        : { [field]: field === "member_ids" ? [a.id] : a.id };
    const ent = await create(input);
    const action = new FieldAction(input, ent);
    action.getTriggers = () => [
      {
        changeset: (builder) => {
          builder.orchestrator.addInboundEdge(a.id, edge, "Contact", {
            data: "enriched",
          });
          builder.orchestrator.addInboundEdge(b.id, edge, "Contact", {
            data: "manual",
          });
          builder.orchestrator.removeInboundEdge(c.id, edge);
        },
      },
    ];
    await action.saveX();
    expect(await rows(ent, edge)).toEqual(
      [
        { id1: a.id, data: "enriched" },
        { id1: b.id, data: "manual" },
      ].sort((x, y) => String(x.id1).localeCompare(String(y.id1))),
    );
    expect(queued(action, WriteOperation.Delete, edge)).toEqual([c.id]);
  });
}

for (const stored of [true, false]) {
  test(`manual insertion survives field replacement (stored endpoint: ${stored})`, async () => {
    const ent = await create({ owner_id: a.id });
    const initial = stored ? a.id : b.id;
    const action = new FieldAction({ owner_id: initial }, ent);
    await action.builder.orchestrator.getEditedData();
    action.builder.orchestrator.addInboundEdge(initial, ownerEdge, "Contact", {
      data: "explicit",
    });
    action.getTriggers = () => [
      {
        changeset: (builder) => {
          builder.updateInput({ owner_id: c.id });
        },
      },
    ];
    await action.saveX();
    expect((await raw(ent.id))!.owner_id).toBe(c.id);
    expect(await rows(ent)).toEqual(
      [
        { id1: initial, data: "explicit" },
        { id1: c.id, data: null },
      ].sort((x, y) => String(x.id1).localeCompare(String(y.id1))),
    );
  });
}

test("manual removal survives restoring a field to its original endpoint", async () => {
  const ent = await create({ owner_id: a.id });
  const action = new FieldAction({ owner_id: b.id }, ent);
  await action.builder.orchestrator.getEditedData();
  action.builder.orchestrator.removeInboundEdge(a.id, ownerEdge);
  action.getTriggers = () => [
    {
      changeset: (builder) => {
        builder.updateInput({ owner_id: a.id });
      },
    },
  ];
  await action.saveX();
  expect((await raw(ent.id))!.owner_id).toBe(a.id);
  expect(await rows(ent)).toEqual([]);
});

function editContact() {
  return new SimpleAction(
    viewer,
    contactSchema,
    new Map([["name", "edited owner"]]),
    WriteOperation.Edit,
    a,
  );
}

test("manual literal deletion wins over a field referencing an existing Builder", async () => {
  const ent = await create({ owner_id: a.id });
  const owner = editContact();
  const action = new FieldAction({ owner_id: owner.builder }, ent);
  action.getTriggers = () => [{ changeset: () => owner.changeset() }];
  action.builder.orchestrator.removeInboundEdge(a.id, ownerEdge);
  await action.saveX();
  expect((await raw(ent.id))!.owner_id).toBe(a.id);
  expect(await rows(ent)).toEqual([]);
});

test("manual existing-Builder insertion survives replacing the stored endpoint", async () => {
  const ent = await create({ owner_id: a.id });
  const owner = editContact();
  const action = new FieldAction({ owner_id: b.id }, ent);
  action.getTriggers = () => [{ changeset: () => owner.changeset() }];
  action.builder.orchestrator.addInboundEdge(
    owner.builder,
    ownerEdge,
    "Contact",
    { data: "manual-builder" },
  );
  await action.saveX();
  expect((await raw(ent.id))!.owner_id).toBe(b.id);
  expect(await rows(ent)).toEqual(
    [
      { id1: a.id, data: "manual-builder" },
      { id1: b.id, data: null },
    ].sort((x, y) => String(x.id1).localeCompare(String(y.id1))),
  );
});

test.each([
  false,
  true,
])("manual data wins across literal/Builder aliases (manual Builder: %s)", async (manualBuilder) => {
  const owner = editContact();
  const action = new FieldAction({
    name: "alias",
    owner_id: manualBuilder ? a.id : owner.builder,
  });
  action.getTriggers = () => [{ changeset: () => owner.changeset() }];
  action.builder.orchestrator.addInboundEdge(
    manualBuilder ? owner.builder : a.id,
    ownerEdge,
    "Contact",
    { data: "manual-alias" },
  );
  const ent = await action.saveX();
  expect((await raw(ent.id))!.owner_id).toBe(a.id);
  expect(await rows(ent)).toEqual([{ id1: a.id, data: "manual-alias" }]);
});

test("new Builders retain distinct dependencies and shared ownership", async () => {
  const first = new SimpleAction(
    viewer,
    contactSchema,
    new Map([["name", "first"]]),
    WriteOperation.Insert,
    null,
  );
  const second = new SimpleAction(
    viewer,
    contactSchema,
    new Map([["name", "second"]]),
    WriteOperation.Insert,
    null,
  );
  const action = new FieldAction({
    name: "new owners",
    owner_id: first.builder,
    second_owner_id: first.builder,
  });
  action.builder.orchestrator.addInboundEdge(
    first.builder,
    ownerEdge,
    "Contact",
    { data: "manual-new" },
  );
  action.builder.updateInput({ owner_id: second.builder });
  action.getTriggers = () => [
    { changeset: () => first.changeset() },
    { changeset: () => second.changeset() },
  ];
  const ent = await action.saveX();
  const firstID = (await first.editedEntX()).id;
  const secondID = (await second.editedEntX()).id;
  expect((await raw(ent.id))!.owner_id).toBe(secondID);
  expect((await raw(ent.id))!.second_owner_id).toBe(firstID);
  expect(await rows(ent)).toEqual(
    [
      { id1: firstID, data: "manual-new" },
      { id1: secondID, data: null },
    ].sort((x, y) => String(x.id1).localeCompare(String(y.id1))),
  );
});

for (const operation of ["create", "edit"]) {
  test.each([
    "delete",
    "undefined",
    "null",
    "override",
  ])(`${operation}: reset default input with %s`, async (reset) => {
    const ent =
      operation === "edit" ? await create({}, new IDViewer(b.id)) : null;
    const action = new FieldAction({ name: "changed" }, ent);
    action.getTriggers = () => [
      {
        changeset: (builder) => {
          if (reset === "delete") {
            builder.fields.delete("default_owner_id");
          } else {
            builder.updateInput({
              default_owner_id:
                reset === "undefined"
                  ? undefined
                  : reset === "null"
                    ? null
                    : c.id,
            });
          }
        },
      },
    ];
    const saved = await action.saveX();
    const expected =
      reset === "null" ? null : reset === "override" ? c.id : a.id;
    expect((await raw(saved.id))!.default_owner_id).toBe(expected);
    expect(await rows(saved, defaultEdge)).toEqual(
      expected === null ? [] : expectedRows(expected),
    );
  });
}

test("clearing edit defaults with no other data keeps the stored field and inverse", async () => {
  const ent = await create({}, new IDViewer(b.id));
  const action = new FieldAction({}, ent);
  action.getTriggers = () => [
    {
      changeset: (builder) => {
        builder.fields.delete("default_owner_id");
        builder.fields.delete("updatedAt");
      },
    },
  ];
  await action.saveX();
  expect((await raw(ent.id))!.default_owner_id).toBe(b.id);
  expect(await rows(ent, defaultEdge)).toEqual(expectedRows(b.id));
});
