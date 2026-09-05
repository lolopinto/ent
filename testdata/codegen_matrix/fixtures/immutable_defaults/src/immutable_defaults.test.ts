import {
  Allow,
  Deny,
  AlwaysDenyPrivacyPolicy,
  IDViewer,
  LoggedOutViewer,
} from "@snowtop/ent";
import { WriteOperation } from "@snowtop/ent/action";
import { SQLStatementOperation } from "@snowtop/ent/schema";
import { Dialect } from "@snowtop/ent/core/db";
import { loadEdges } from "@snowtop/ent/core/ent";
import { createRowForTest } from "@snowtop/ent/testutils/write";
import {
  assoc_edge_config_table,
  assoc_edge_table,
  getSchemaTable,
  setupSqlite,
} from "@snowtop/ent/testutils/db/temp_db";
import { Document, User } from "./ent";
import { EdgeType } from "./ent/generated/types";
import { CreateUserActionBase } from "./ent/generated/user/actions/create_user_action_base";
import { CreateDocumentActionBase } from "./ent/generated/document/actions/create_document_action_base";
import { EditDocumentActionBase } from "./ent/generated/document/actions/edit_document_action_base";
import DocumentSchema from "./schema/document_schema";
import UserSchema from "./schema/user_schema";

const edgeTables = [
  [EdgeType.UserToDocuments, "user_documents_table"],
  [EdgeType.UserToInternalDocuments, "user_internal_documents_table"],
];

// The harness runs in its own temporary app; no shared database is touched.
setupSqlite(process.env.DB_CONNECTION_STRING!, () => [
  getSchemaTable({ ...UserSchema, ent: User }, Dialect.SQLite),
  getSchemaTable({ ...DocumentSchema, ent: Document }, Dialect.SQLite),
  assoc_edge_config_table(),
  ...edgeTables.map(([, table]) => assoc_edge_table(table)),
]);

beforeEach(async () => {
  for (const [edgeType, table] of edgeTables) {
    await createRowForTest({
      tableName: "assoc_edge_config",
      fields: {
        edge_type: edgeType,
        edge_name: table,
        edge_table: table,
        symmetric_edge: false,
        inverse_edge_type: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  }
});

afterEach(() => jest.restoreAllMocks());

async function createViewer() {
  const user = await new CreateUserActionBase(new LoggedOutViewer(), {
    name: "Owner",
  }).saveX();
  return new IDViewer(user.id);
}

async function expectEdges(viewer: IDViewer, document: Document) {
  for (const [edgeType] of edgeTables) {
    const edges = await loadEdges({ id1: viewer.viewerID, edgeType });
    expect(edges.map((edge) => edge.id2)).toContain(document.id);
  }
}

test("generated base action initializes omitted immutable defaults and inverse edges", async () => {
  const viewer = await createViewer();
  const action = new CreateDocumentActionBase(viewer, {
    title: "Default owner",
  });
  const document = await action.saveX();
  expect(document.ownerId).toBe(viewer.viewerID);
  expect(document.internalOwnerId).toBe(viewer.viewerID);
  expect(document.syncValue).toBe("sync");
  expect(document.asyncValue).toBe("async");
  expect(action.builder.getInput()).toMatchObject({
    ownerId: viewer.viewerID,
    internalOwnerId: viewer.viewerID,
    syncValue: " SYNC ",
    asyncValue: " ASYNC ",
  });
  await expectEdges(viewer, document);
});

test("triggers and validators see initialized input and field validation still runs", async () => {
  const viewer = await createViewer();
  const calls: string[] = [];
  class HookedCreate extends CreateDocumentActionBase {
    getTriggers() {
      return [
        {
          changeset: (
            builder: this["builder"],
            input: ReturnType<this["getInput"]>,
          ) => {
            // Hook input is the original action input by contract; defaults live on the builder.
            expect(input).toEqual({ title: "Initial" });
            expect(builder.getNewOwnerIdValue()).toBe(viewer.viewerID);
            expect(builder.getInput().asyncValue).toBe(" ASYNC ");
            calls.push("trigger");
            builder.updateInput({
              title: `${builder.getInput().syncValue!.trim()} title`,
              syncValue: " TRIGGER VALUE ",
            });
          },
        },
      ];
    }
    getValidators() {
      return [
        {
          validate: (
            builder: this["builder"],
            input: ReturnType<this["getInput"]>,
          ) => {
            expect(input).toEqual({ title: "Initial" });
            expect(builder.getInput().ownerId).toBe(viewer.viewerID);
            expect(builder.getInput().title).toBe("SYNC title");
            expect(builder.getNewSyncValueValue()).toBe(" TRIGGER VALUE ");
            calls.push("validator");
          },
        },
      ];
    }
  }
  const document = await new HookedCreate(viewer, { title: "Initial" }).saveX();
  expect(document.title).toBe("SYNC title");
  expect(document.syncValue).toBe("trigger value");
  expect(calls).toEqual(["trigger", "validator"]);
  jest
    .spyOn(DocumentSchema.fields.syncValue, "defaultValueOnCreate")
    .mockReturnValue("");
  await expect(
    new CreateDocumentActionBase(viewer, { title: "Invalid default" }).saveX(),
  ).rejects.toThrow(/syncValue/);
});

test("explicit immutable inputs take precedence over create defaults", async () => {
  const viewer = await createViewer();
  const syncDefault = jest.spyOn(
    DocumentSchema.fields.syncValue,
    "defaultValueOnCreate",
  );
  const asyncDefault = jest.spyOn(
    DocumentSchema.fields.asyncValue,
    "defaultValueOnCreate",
  );
  const document = await new CreateDocumentActionBase(viewer, {
    title: "Explicit",
    ownerId: viewer.viewerID,
    syncValue: " CHOSEN ",
    asyncValue: " PROVIDED ",
  }).saveX();
  expect(document.ownerId).toBe(viewer.viewerID);
  expect(document.syncValue).toBe("chosen");
  expect(document.asyncValue).toBe("provided");
  expect(syncDefault).not.toHaveBeenCalled();
  expect(asyncDefault).not.toHaveBeenCalled();
  await expectEdges(viewer, document);
});

test("public updateInput assigns immutable fields during creation and rejects edits", async () => {
  const viewer = await createViewer();
  const create = new CreateDocumentActionBase(viewer, {
    title: "Assignable on create",
  });
  create.builder.updateInput({
    ownerId: viewer.viewerID,
    syncValue: " ASSIGNED ",
  });
  expect(create.builder.getNewOwnerIdValue()).toBe(viewer.viewerID);
  expect(create.builder.getNewSyncValueValue()).toBe(" ASSIGNED ");
  const document = await create.saveX();
  expect(document.syncValue).toBe("assigned");
  await expectEdges(viewer, document);
  const edit = new EditDocumentActionBase(viewer, document, {
    title: "Updated",
  });
  expect(() => edit.builder.updateInput({ ownerId: viewer.viewerID })).toThrow(
    /overrideOwnerId/,
  );
  expect(() => edit.builder.updateInput({ syncValue: "forbidden" })).toThrow(
    /overrideSyncValue/,
  );
  edit.builder.overrideSyncValue(" OVERRIDDEN ");
  expect(() =>
    edit.builder.updateInput({ syncValue: "still forbidden" }),
  ).toThrow(/overrideSyncValue/);
  const updated = await edit.saveX();
  expect(updated.ownerId).toBe(viewer.viewerID);
  expect(updated.syncValue).toBe("overridden");
  expect(updated.title).toBe("Updated");
});

test.each([
  "constructor",
  "setter",
  "setter after default resolution",
])("ownership privacy rejects a forged owner from %s", async (source) => {
  const viewer = await createViewer();
  const other = await createViewer();
  const action = new CreateDocumentActionBase(viewer, {
    title: "Forged",
    ...(source === "constructor" ? { ownerId: other.viewerID } : {}),
  });
  let id: string;
  if (source === "setter after default resolution") {
    id = (await action.builder.orchestrator.getEditedData()).id;
  }
  if (source !== "constructor") {
    action.builder.updateInput({ ownerId: other.viewerID });
    expect(action.getInput().ownerId).toBeUndefined();
  }
  id ??= (await action.builder.orchestrator.getEditedData()).id;
  const result = await action.saveX().catch((error) => error);
  expect(await Document.loadRawData(id)).toBeNull();
  expect(result).toBeInstanceOf(Error);
  expect(result.message).toMatch(/does not have permission to create/);
  for (const [edgeType] of edgeTables) {
    expect(await loadEdges({ id1: viewer.viewerID, edgeType })).toHaveLength(0);
    expect(await loadEdges({ id1: other.viewerID, edgeType })).toHaveLength(0);
  }
});

test("immutable edit defaults still use the guarded input path", async () => {
  const viewer = await createViewer();
  const existing = await new CreateDocumentActionBase(viewer, {
    title: "Original",
  }).saveX();
  const field = DocumentSchema.fields.syncValue;
  const originalDefault = field.defaultValueOnEdit;
  field.defaultValueOnEdit = () => "forbidden edit default";
  try {
    await expect(
      new EditDocumentActionBase(viewer, existing, { title: "Edited" }).saveX(),
    ).rejects.toThrow(/overrideSyncValue/);
  } finally {
    field.defaultValueOnEdit = originalDefault;
  }
  expect((await Document.loadX(viewer, existing.id)).syncValue).toBe("sync");
});

test("insert transformed to edit does not initialize create defaults", async () => {
  const viewer = await createViewer();
  const existing = await new CreateDocumentActionBase(viewer, {
    title: "Original",
  }).saveX();
  const syncDefault = jest.spyOn(
    DocumentSchema.fields.syncValue,
    "defaultValueOnCreate",
  );
  const asyncDefault = jest.spyOn(
    DocumentSchema.fields.asyncValue,
    "defaultValueOnCreate",
  );
  class InsertAsEdit extends CreateDocumentActionBase {
    transformWrite() {
      return { op: SQLStatementOperation.Update, existingEnt: existing };
    }
    getTriggers() {
      return [
        {
          changeset: (builder: this["builder"]) => {
            expect(builder.operation).toBe(WriteOperation.Insert);
            expect(() =>
              builder.updateInput({ syncValue: "forbidden in trigger" }),
            ).toThrow(/overrideSyncValue/);
          },
        },
      ];
    }
  }
  const action = new InsertAsEdit(viewer, { title: "Transformed edit" });
  const updated = await action.saveX();
  expect(updated.id).toBe(existing.id);
  expect(updated.ownerId).toBe(viewer.viewerID);
  expect(updated.syncValue).toBe("sync");
  expect(action.builder.getInput().ownerId).toBeUndefined();
  expect(syncDefault).not.toHaveBeenCalled();
  expect(asyncDefault).not.toHaveBeenCalled();
  expect(() =>
    action.builder.updateInput({ ownerId: viewer.viewerID }),
  ).toThrow(/overrideOwnerId/);
});

test("edit transformed to insert initializes defaults during validation", async () => {
  const viewer = await createViewer();
  const existing = await new CreateDocumentActionBase(viewer, {
    title: "Original",
  }).saveX();
  class EditAsInsert extends EditDocumentActionBase {
    transformWrite() {
      return { op: SQLStatementOperation.Insert };
    }
    getTriggers() {
      return [
        {
          changeset: (builder: this["builder"]) => {
            expect(builder.operation).toBe(WriteOperation.Edit);
            expect(builder.getNewSyncValueValue()).toBe(" SYNC ");
            builder.updateInput({ syncValue: " TRIGGER INSERT " });
          },
        },
      ];
    }
  }
  const action = new EditAsInsert(viewer, existing, {
    title: "Transformed insert",
  });
  expect(action.builder.operation).toBe(WriteOperation.Edit);
  // Test initialization only: edit-to-insert persistence separately retains the
  // original existingEnt in EditNodeOperation and is outside this regression.
  await action.validX();
  expect(action.builder.getInput()).toMatchObject({
    ownerId: viewer.viewerID,
    syncValue: " TRIGGER INSERT ",
    asyncValue: " ASYNC ",
  });
  expect(action.builder.orchestrator.getValidatedFields().sync_value).toBe(
    "trigger insert",
  );
  const data = await action.builder.orchestrator.getEditedData();
  expect(data.id).not.toBe(existing.id);
  expect(data.owner_id).toBe(viewer.viewerID);
  for (const [edgeType] of edgeTables) {
    expect(
      action.builder.orchestrator.getInputEdges(
        edgeType,
        WriteOperation.Insert,
      ),
    ).toEqual([expect.objectContaining({ id: viewer.viewerID })]);
  }
  expect((await Document.loadX(viewer, existing.id)).title).toBe("Original");
});

test.each([
  "constructor",
  "before transform",
  "inside transform",
])("create-to-edit rejects immutable values assigned %s", async (phase) => {
  const viewer = await createViewer();
  const existing = await new CreateDocumentActionBase(viewer, {
    title: "Original",
  }).saveX();
  let assigned = phase === "constructor";
  class InsertAsEdit extends CreateDocumentActionBase {
    async transformWrite() {
      if (phase === "inside transform") {
        await Promise.resolve();
        this.builder.updateInput({ syncValue: "forbidden" });
        assigned = true;
      }
      return { op: SQLStatementOperation.Update, existingEnt: existing };
    }
  }
  const action = new InsertAsEdit(viewer, {
    title: "Attempted edit",
    ...(phase === "constructor" ? { syncValue: "forbidden" } : {}),
  });
  if (phase === "before transform") {
    action.builder.updateInput({ syncValue: "forbidden" });
    assigned = true;
  }
  await expect(action.saveX()).rejects.toThrow(/overrideSyncValue/);
  expect(assigned).toBe(true);
  const unchanged = await Document.loadX(viewer, existing.id);
  expect(unchanged.syncValue).toBe("sync");
  expect(unchanged.title).toBe("Original");
  await expectEdges(viewer, unchanged);
});

test("create-to-edit retains explicit overrides", async () => {
  const viewer = await createViewer();
  const existing = await new CreateDocumentActionBase(viewer, {
    title: "Original",
  }).saveX();
  class InsertAsEdit extends CreateDocumentActionBase {
    transformWrite() {
      return { op: SQLStatementOperation.Update, existingEnt: existing };
    }
  }
  const action = new InsertAsEdit(viewer, {
    title: "Explicit override",
    syncValue: "initial",
  });
  action.builder.overrideSyncValue(" OVERRIDDEN ");
  const updated = await action.saveX();
  expect(updated.id).toBe(existing.id);
  expect(updated.syncValue).toBe("overridden");
});

test("ordinary creation assignment clears an earlier override before a transform to edit", async () => {
  const viewer = await createViewer();
  const existing = await new CreateDocumentActionBase(viewer, {
    title: "Original",
  }).saveX();
  class InsertAsEdit extends CreateDocumentActionBase {
    transformWrite() {
      return { op: SQLStatementOperation.Update, existingEnt: existing };
    }
  }
  const action = new InsertAsEdit(viewer, { title: "Attempted edit" });
  action.builder.overrideSyncValue("override");
  action.builder.updateInput({ syncValue: "ordinary assignment" });
  await expect(action.saveX()).rejects.toThrow(/overrideSyncValue/);
  expect((await Document.loadX(viewer, existing.id)).syncValue).toBe("sync");
});

test.each([
  true,
  false,
])("creation assignments in transformWrite retain precedence (returns transform: %s)", async (returnsTransform) => {
  const viewer = await createViewer();
  const syncDefault = jest.spyOn(
    DocumentSchema.fields.syncValue,
    "defaultValueOnCreate",
  );
  class AssignDuringCreate extends CreateDocumentActionBase {
    async transformWrite() {
      await Promise.resolve();
      this.builder.updateInput({ syncValue: " ASSIGNED DURING TRANSFORM " });
      return returnsTransform ? { op: SQLStatementOperation.Insert } : null;
    }
  }
  const document = await new AssignDuringCreate(viewer, {
    title: "Created",
  }).saveX();
  expect(document.syncValue).toBe("assigned during transform");
  expect(syncDefault).not.toHaveBeenCalled();
});

test("privacy refresh preserves default provenance without rerunning default callbacks", async () => {
  const viewer = await createViewer();
  const field = DocumentSchema.fields.syncValue;
  const originalPolicy = field.editPrivacyPolicy;
  const defaultValue = jest.spyOn(field, "defaultValueOnCreate");
  field.editPrivacyPolicy = AlwaysDenyPrivacyPolicy;
  try {
    const allowed = new CreateDocumentActionBase(viewer, { title: "Default" });
    await allowed.builder.orchestrator.getEditedData();
    await allowed.validX();
    expect((await allowed.saveX()).syncValue).toBe("sync");
    expect(defaultValue).toHaveBeenCalledTimes(1);

    const denied = new CreateDocumentActionBase(viewer, {
      title: "Caller assignment",
    });
    const id = (await denied.builder.orchestrator.getEditedData()).id;
    denied.builder.updateInput({ syncValue: "caller value" });
    await expect(denied.saveX()).rejects.toThrow(
      /does not have permission to edit field sync_value/,
    );
    expect(await Document.loadRawData(id)).toBeNull();
    expect(defaultValue).toHaveBeenCalledTimes(2);
  } finally {
    field.editPrivacyPolicy = originalPolicy;
  }
});

test("transformed data still reaches builder input and persistence", async () => {
  const viewer = await createViewer();
  let transforms = 0;
  class TransformData extends CreateDocumentActionBase {
    transformWrite() {
      transforms++;
      return {
        op: SQLStatementOperation.Insert,
        data: { title: "Transformed title" },
      };
    }
  }
  const action = new TransformData(viewer, { title: "Original title" });
  await action.builder.orchestrator.getEditedData();
  expect(action.getInput().title).toBe("Original title");
  expect(action.builder.getInput().title).toBe("Transformed title");
  await action.validX();
  expect((await action.saveX()).title).toBe("Transformed title");
  expect(transforms).toBe(1);
});

test("custom privacy reads current immutable values through the unsafe-ent helper", async () => {
  const viewer = await createViewer();
  const other = await createViewer();
  class CustomPrivacyCreate extends CreateDocumentActionBase {
    getPrivacyPolicy() {
      return {
        rules: [
          {
            apply: async () => {
              const ent =
                await this.builder.orchestrator.getPossibleUnsafeEntForPrivacy();
              return ent.ownerId === this.viewer.viewerID ? Allow() : Deny();
            },
          },
        ],
      };
    }
  }
  const action = new CustomPrivacyCreate(viewer, { title: "Custom privacy" });
  const id = (await action.builder.orchestrator.getEditedData()).id;
  action.builder.updateInput({ ownerId: other.viewerID });
  const result = await action.saveX().catch((error) => error);
  expect(await Document.loadRawData(id)).toBeNull();
  expect(result).toBeInstanceOf(Error);
  expect(result.message).toMatch(/does not have permission to create/);
  for (const [edgeType] of edgeTables) {
    expect(await loadEdges({ id1: viewer.viewerID, edgeType })).toHaveLength(0);
    expect(await loadEdges({ id1: other.viewerID, edgeType })).toHaveLength(0);
  }
});
