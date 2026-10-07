import { graphql, GraphQLObjectType, GraphQLSchema } from "graphql";
import { LoggedOutViewer } from "@snowtop/ent";
import { encodeGQLID, mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { Dialect } from "@snowtop/ent/core/db";
import { setupSqlite, getSchemaTable } from "@snowtop/ent/testutils/db/temp_db";
import { Settings, Holiday } from "./ent";
import SettingsSchema from "./schema/settings_schema";
import HolidaySchema from "./schema/holiday_schema";
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
