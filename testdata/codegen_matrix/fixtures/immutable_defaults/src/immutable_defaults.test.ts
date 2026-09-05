import { IDViewer, LoggedOutViewer } from "@snowtop/ent";
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
            calls.push("validator");
          },
        },
      ];
    }
  }
  const document = await new HookedCreate(viewer, { title: "Initial" }).saveX();
  expect(document.title).toBe("SYNC title");
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

test("public updateInput rejects immutable changes on both create and edit", async () => {
  const viewer = await createViewer();
  const create = new CreateDocumentActionBase(viewer, { title: "Guarded" });
  expect(() =>
    create.builder.updateInput({ ownerId: viewer.viewerID }),
  ).toThrow(/overrideOwnerId/);
  expect(() => create.builder.updateInput({ syncValue: "forged" })).toThrow(
    /overrideSyncValue/,
  );
  const document = await create.saveX();
  const edit = new EditDocumentActionBase(viewer, document, {
    title: "Updated",
  });
  expect(() => edit.builder.updateInput({ ownerId: viewer.viewerID })).toThrow(
    /overrideOwnerId/,
  );
  expect(() => edit.builder.updateInput({ asyncValue: "forged" })).toThrow(
    /overrideAsyncValue/,
  );
  const updated = await edit.saveX();
  expect(updated.ownerId).toBe(viewer.viewerID);
  expect(updated.syncValue).toBe("sync");
  expect(updated.title).toBe("Updated");
});

test("ownership privacy rejects explicit forged owner input", async () => {
  const viewer = await createViewer();
  const other = await createViewer();
  await expect(
    new CreateDocumentActionBase(viewer, {
      title: "Forged",
      ownerId: other.viewerID,
    }).saveX(),
  ).rejects.toThrow(/does not have permission to create/);
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
    syncValue: " SYNC ",
    asyncValue: " ASYNC ",
  });
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
