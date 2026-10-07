import { graphql, GraphQLObjectType, GraphQLSchema } from "graphql";
import { LoggedOutViewer } from "@snowtop/ent";
import { encodeGQLID, mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { Dialect } from "@snowtop/ent/core/db";
import { setupSqlite, getSchemaTable } from "@snowtop/ent/testutils/db/temp_db";
import { Settings, Holiday } from "./ent";
import SettingsSchema from "./schema/settings_schema";
import HolidaySchema from "./schema/holiday_schema";
import CreatePaymentAction from "./ent/payment/actions/create_payment_action";
import schema from "./graphql/generated/schema";
import { HolidayOverrideEntryType } from "./graphql/generated/resolvers/holiday_override_entry_type";
import { CreateSettingsActionBase } from "./ent/generated/settings/actions/create_settings_action_base";

setupSqlite(process.env.DB_CONNECTION_STRING!, () => [
  getSchemaTable({ ...SettingsSchema, ent: Settings }, Dialect.SQLite),
  getSchemaTable({ ...HolidaySchema, ent: Holiday }, Dialect.SQLite),
]);
const viewer = new LoggedOutViewer();
const contextValue = { getViewer: () => viewer };
const id = "00000000-0000-4000-8000-000000000001";
const encoded = encodeGQLID({ id, nodeType: "holiday" });
const otherId = "00000000-0000-4000-8000-000000000002";
const expectedIDs = [encoded, encodeGQLID({ id: otherId, nodeType: "holiday" }), encoded];
const selection = `id savedReference savedRawReference overrides { holidayId } nested { entries { holidayId } reference references raw } referenceId references rawId`;

async function execute(source: string, variableValues?: Record<string, unknown>) {
  const result = await graphql({ schema, source, variableValues, contextValue });
  expect(result.errors).toBeUndefined();
  return result.data as any;
}

test("actual global output encodes a deleted reference without loading or mutating it", async () => {
  const stored = Object.freeze({ holidayId: id });
  const load = jest.spyOn(Holiday, "load");
  const localSchema = new GraphQLSchema({ query: new GraphQLObjectType({
    name: "Query", fields: { override: { type: HolidayOverrideEntryType, resolve: () => stored } },
  }) });
  const result = await graphql({ schema: localSchema, source: "{ override { holidayId } }" });
  expect(result.errors).toBeUndefined();
  expect(result.data?.override).toEqual({ holidayId: encoded });
  expect(stored.holidayId).toBe(id);
  expect(load).not.toHaveBeenCalled();
  load.mockRestore();
});

test("generated query/edit/save preserves raw storage, duplicates, null and empty lists", async () => {
  const raw = {
    savedReference: id, savedRawReference: id,
    overrides: [{ holidayId: id }, { holidayId: otherId }, { holidayId: id }],
    nested: { entries: [{ holidayId: id }], reference: id, references: [id, otherId, id], raw: id },
  };
  const settings = await new CreateSettingsActionBase(viewer, raw).saveX();
  expect(settings.overrides).toEqual(raw.overrides);
  expect(settings.nested).toEqual(raw.nested);
  const gqlID = encodeGQLID(settings);
  const data = await execute(`query($id: ID!) { node(id: $id) { ... on Settings { ${selection} } } }`, { id: gqlID });
  expect(data.node.overrides).toEqual(expectedIDs.map((holidayId) => ({ holidayId })));
  expect(data.node.nested).toEqual({ entries: [{ holidayId: encoded }], reference: encoded, references: expectedIDs, raw: id });
  expect(data.node.savedReference).toBe(encoded);
  expect(data.node.savedRawReference).toBe(id);
  expect(data.node.referenceId).toBe(encoded);
  expect(data.node.references).toEqual(expectedIDs);
  expect(data.node.rawId).toBe(id);
  expect(settings.overrides).toEqual(raw.overrides);
  expect(settings.nested).toEqual(raw.nested);

  const update = async (overrides: unknown, nested: unknown) => execute(
    `mutation($input: SettingsEditInput!) { settingsEdit(input: $input) { settings { ${selection} } } }`,
    { input: { id: gqlID, overrides, nested } },
  );
  const saved = await update(data.node.overrides, data.node.nested);
  expect(saved.settingsEdit.settings).toEqual(data.node);
  const loaded = await Settings.loadX(viewer, settings.id);
  expect(loaded.overrides).toEqual(raw.overrides);
  expect(loaded.nested).toEqual(raw.nested);
  expect(await Holiday.load(viewer, id)).toBeNull();

  const nulls = await update(null, { entries: null, reference: null, references: null, raw: null });
  expect(nulls.settingsEdit.settings.overrides).toBeNull();
  expect(nulls.settingsEdit.settings.nested).toEqual({ entries: null, reference: null, references: null, raw: null });
  const empty = await update([], { entries: [], reference: null, references: [], raw: null });
  expect(empty.settingsEdit.settings.overrides).toEqual([]);
  expect(empty.settingsEdit.settings.nested.entries).toEqual([]);
  expect(empty.settingsEdit.settings.nested.references).toEqual([]);
  expect((await update(null, null)).settingsEdit.settings.nested).toBeNull();
});

test("generated create decodes GraphQL literal inputs before persistence", async () => {
  const data = await execute(`mutation { settingsCreate(input: {
    overrides: [{holidayId: "${encoded}"}],
    nested: { entries: [{holidayId: "${encoded}"}], reference: "${encoded}", references: [], raw: "${id}" }
  }) { settings { ${selection} } } }`);
  const settings = await Settings.loadX(viewer, mustDecodeIDFromGQLID(data.settingsCreate.settings.id));
  expect(settings.overrides).toEqual([{ holidayId: id }]);
  expect(settings.nested).toEqual({ entries: [{ holidayId: id }], reference: id, references: [], raw: id });
});


test("generated union member output round-trips through edit and literal create", async () => {
  const settings = await new CreateSettingsActionBase(viewer, {
    selection: { choice: { holidayId: id } },
  }).saveX();
  // Test the actual generated member directly; union resolveType customization
  // is independent of scalar encoding and mutation conversion.
  const memberSchema = new GraphQLSchema({ query: new GraphQLObjectType({
    name: "MemberQuery", fields: { choice: {
      type: schema.getType("HolidayChoice") as GraphQLObjectType,
      resolve: () => settings.selection!.choice,
    } },
  }) });
  const data = await graphql({ schema: memberSchema, source: "{ choice { holidayId } }" });
  expect(data.errors).toBeUndefined();
  expect((data.data as any).choice).toEqual({ holidayId: encoded });
  const update = async (selection: unknown) => execute(
    `mutation($input: SettingsEditInput!) { settingsEdit(input: $input) { settings { id } } }`,
    { input: { id: encodeGQLID(settings), selection } },
  );
  await update({ choice: { holiday: (data.data as any).choice } });
  expect((await Settings.loadX(viewer, settings.id)).selection).toEqual({ choice: { holidayId: id } });
  expect(settings.selection).toEqual({ choice: { holidayId: id } });
  await update({ choice: { raw: { label: "external", rawId: id } } });
  expect((await Settings.loadX(viewer, settings.id)).selection).toEqual({ choice: { label: "external", rawId: id } });
  await update({ choice: null });
  expect((await Settings.loadX(viewer, settings.id)).selection).toEqual({ choice: null });
  await update(null);
  expect((await Settings.loadX(viewer, settings.id)).selection).toBeNull();

  const created = await execute(`mutation { settingsCreate(input: {
    selection: { choice: { holiday: { holidayId: "${encoded}" } } }
  }) { settings { id } } }`);
  expect((await Settings.loadX(viewer, mustDecodeIDFromGQLID(created.settingsCreate.settings.id))).selection)
    .toEqual({ choice: { holidayId: id } });
});

test("generated nested action-only object lists preserve null elements and decode non-null IDs", async () => {
  const saveX = jest.fn(async () => ({}));
  const create = jest.spyOn(CreatePaymentAction, "create").mockReturnValue({ saveX } as any);
  try {
    for (const optionalRegistrations of [null, [], [null, { registryId: encoded }, null]]) {
      const batch = { name: "batch", registrations: [null, { registryId: encoded }, null], optionalRegistrations };
      await execute(`mutation($input: PaymentCreateInput!) {
        paymentCreate(input: $input) { __typename }
      }`, { input: { name: "payment", batch } });
      expect(create.mock.calls[create.mock.calls.length - 1]?.[1]).toEqual({ name: "payment", batch: {
        name: "batch", registrations: [null, { registryId: id }, null],
        optionalRegistrations: optionalRegistrations?.map((entry) => entry == null ? null : { registryId: id }) ?? null,
      } });
      expect(batch.registrations).toEqual([null, { registryId: encoded }, null]);
    }
  } finally {
    create.mockRestore();
  }
});


test("embedded create/edit/delete inputs decode identity and optional references without losing omission", async () => {
  const create = jest.spyOn(CreatePaymentAction, "create").mockReturnValue({saveX: async () => ({})} as any);
  const registrationID = encodeGQLID({id: otherId, nodeType: "registration"});
  try {
    for (const [references, expected] of [
      [{}, {}],
      [{registryId: null, registryIds: null, rawId: null}, {registryId: null, registryIds: null, rawId: null}],
      [{registryId: encoded, registryIds: [], rawId: id}, {registryId: id, registryIds: [], rawId: id}],
      [{registryId: encoded, registryIds: [encoded, encoded]}, {registryId: id, registryIds: [id, id]}],
    ]) {
      await execute(`mutation($input: PaymentCreateInput!) {paymentCreate(input: $input) {__typename}}`, {input: {
        name: "payment", batch: {name: "batch", registrations: [references]},
        editRegistration: {id: registrationID, ...references}, deleteRegistration: {id: registrationID},
      }});
      const passed = create.mock.calls[create.mock.calls.length - 1][1] as any;
      expect(passed.batch.registrations[0]).toStrictEqual(expected);
      expect(passed.editRegistration).toStrictEqual({id: otherId, ...expected});
      expect(passed.deleteRegistration).toStrictEqual({id: otherId});
    }
  } finally { create.mockRestore(); }
});

test("decorated input and argument ID fields compile and retain input values", async () => {
  expect((await execute(`mutation($input: ReferenceInput!) { echoReference(input: $input) }`, {
    input: {holidayId: encoded, references: [encoded]},
  })).echoReference).toBe(encoded);
  const settings = await new CreateSettingsActionBase(viewer, {}).saveX();
  expect((await execute(`query($id: ID!, $filter: ReferenceFilter!) {
    node(id: $id) { ... on Settings { filterReference(filter: $filter) } }
  }`, {id: encodeGQLID(settings), filter: {holidayId: encoded}})).node.filterReference).toBe(encoded);
});


test("unmatched and hidden-target deep UUID scalars round-trip as raw IDs", async () => {
  const rawNested = {inner: {externalId: id, externalIds: [id, otherId, id], secretId: otherId}};
  const selection = "id rawNested { inner { externalId externalIds secretId } }";
  const created = await execute(`mutation($input: SettingsCreateInput!) {
    settingsCreate(input: $input) {settings {${selection}}}
  }`, {input: {rawNested}});
  expect(created.settingsCreate.settings.rawNested).toEqual(rawNested);
  const edited = await execute(`mutation($input: SettingsEditInput!) {
    settingsEdit(input: $input) {settings {${selection}}}
  }`, {input: created.settingsCreate.settings});
  expect(edited.settingsEdit.settings.rawNested).toEqual(rawNested);
  const stored = await Settings.loadX(viewer, mustDecodeIDFromGQLID(edited.settingsEdit.settings.id));
  expect(stored.rawNested).toEqual(rawNested);
});


test("nested nullable action objects decode while preserving null and omitted values", async () => {
  const create = jest.spyOn(CreatePaymentAction, "create").mockReturnValue({saveX: async () => ({})} as any);
  const registrationID = encodeGQLID({id: otherId, nodeType: "registration"});
  try {
    for (const [objects, expected] of [
      [{}, {}],
      [{createdRegistration: null, changedRegistration: null, removedRegistration: null}, {createdRegistration: null, changedRegistration: null, removedRegistration: null}],
      [{createdRegistration: {registryId: encoded}, changedRegistration: {id: registrationID, registryId: encoded}, removedRegistration: {id: registrationID}},
       {createdRegistration: {registryId: id}, changedRegistration: {id: otherId, registryId: id}, removedRegistration: {id: otherId}}],
    ]) {
      const batch = {name: "batch", registrations: [], ...objects};
      await execute(`mutation($input: PaymentCreateInput!) {paymentCreate(input: $input) {__typename}}`, {
        input: {name: "payment", batch},
      });
      const passed = create.mock.calls[create.mock.calls.length - 1][1] as any;
      expect(passed.batch).toStrictEqual({name: "batch", registrations: [], ...expected});
      expect(batch).toStrictEqual({name: "batch", registrations: [], ...objects});
    }
  } finally { create.mockRestore(); }
});


test("self and mutually recursive scalar references round-trip at every depth", async () => {
  const tree = {holidayId: id, children: [{holidayId: otherId, children: [{holidayId: id, children: []}]}, {holidayId: id, children: null}]};
  const mutualTree = {holidayId: id, next: {holidayId: otherId, children: [{holidayId: id, next: {holidayId: otherId, children: []}}]}};
  const settings = await new CreateSettingsActionBase(viewer, {tree, trees: [tree], mutualTree}).saveX();
  const treeSelection = "holidayId children { holidayId children { holidayId children { holidayId } } }";
  const fields = `id tree {${treeSelection}} trees {${treeSelection}} mutualTree {holidayId next {holidayId children {holidayId next {holidayId children {holidayId}}}}}`;
  const data = (await execute(`query($id: ID!) {node(id: $id) {... on Settings {${fields}}}}`, {id: encodeGQLID(settings)})).node;
  expect(data.tree.children[0].children[0].holidayId).toBe(encoded);
  expect(data.trees[0]).toEqual(data.tree);
  expect(data.mutualTree.next.children[0].next.holidayId).toBe(encodeGQLID({id: otherId, nodeType: "holiday"}));
  const edited = await execute(`mutation($input: SettingsEditInput!) {settingsEdit(input: $input) {settings {${fields}}}}`, {input: data});
  expect(edited.settingsEdit.settings).toEqual(data);
  const saved = await Settings.loadX(viewer, settings.id);
  expect(saved.tree).toEqual(tree);expect(saved.trees).toEqual([tree]);expect(saved.mutualTree).toEqual(mutualTree);
  expect(settings.tree).toEqual(tree);
  const {id: _id, ...input} = data;
  const created = await execute(`mutation($input: SettingsCreateInput!) {settingsCreate(input: $input) {settings {id}}}`, {input});
  expect((await Settings.loadX(viewer, mustDecodeIDFromGQLID(created.settingsCreate.settings.id))).tree).toEqual(tree);
});


test("explicit root query and mutation references encode while opt-outs and legacy IDs remain raw", async () => {
  expect(await execute(`{savedHolidayReference savedHolidayReferences missingHolidayReference rawHolidayReference holidayId}`)).toEqual({
    savedHolidayReference: encoded, savedHolidayReferences: [encoded, null, encoded],
    missingHolidayReference: null, rawHolidayReference: id, holidayId: id,
  });
  expect(await execute(`mutation {saveHolidayReference saveHolidayReferences saveRawHolidayReference}`)).toEqual({
    saveHolidayReference: encoded, saveHolidayReferences: [encoded, encoded], saveRawHolidayReference: id,
  });
});
