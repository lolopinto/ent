import {
  AlwaysDenyPrivacyPolicy,
  IDViewer,
  LoggedOutViewer,
} from "@snowtop/ent";
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

// Core default evaluation and privacy tests live in ts/src/action.
// These cases require generated setters, accessors, or inverse-edge wiring.
test("generated defaults reach hooks and edges; trusted overrides survive prevalidation", async () => {
  const viewer = await createViewer();
  const field = DocumentSchema.fields.syncValue;
  const previousPolicy = field.editPrivacyPolicy;
  field.editPrivacyPolicy = AlwaysDenyPrivacyPolicy;
  class HookedCreate extends CreateDocumentActionBase {
    getTriggers() {
      return [
        {
          changeset: (
            builder: this["builder"],
            input: ReturnType<this["getInput"]>,
          ) => {
            expect(input).toEqual({ title: "Created" });
            expect(builder.getInput()).toMatchObject({
              ownerId: viewer.viewerID,
              asyncValue: " ASYNC ",
            });
            builder.overrideSyncValue(" TRIGGER VALUE ");
          },
        },
      ];
    }
    getValidators() {
      return [
        {
          validate: async (builder: this["builder"]) => {
            expect(builder.getNewSyncValueValue()).toBe(" TRIGGER VALUE ");
          },
        },
      ];
    }
  }
  try {
    const action = new HookedCreate(viewer, { title: "Created" });
    await action.builder.orchestrator.getEditedData();
    expect(action.builder.getNewSyncValueValue()).toBe(" SYNC ");
    await action.validX();
    const document = await action.saveX();
    expect(document).toMatchObject({
      ownerId: viewer.viewerID,
      internalOwnerId: viewer.viewerID,
      syncValue: "trigger value",
      asyncValue: "async",
    });
    await expectEdges(viewer, document);
  } finally {
    field.editPrivacyPolicy = previousPolicy;
  }
});

test("constructor values take precedence; public immutable setters require overrides", async () => {
  const viewer = await createViewer();
  const syncDefault = jest.spyOn(
    DocumentSchema.fields.syncValue,
    "defaultValueOnCreate",
  );
  const asyncDefault = jest.spyOn(
    DocumentSchema.fields.asyncValue,
    "defaultValueOnCreate",
  );
  try {
    const create = new CreateDocumentActionBase(viewer, {
      title: "Created",
      syncValue: " CONSTRUCTOR ",
      asyncValue: " PROVIDED ",
    });
    expect(() =>
      create.builder.updateInput({ syncValue: "forbidden" }),
    ).toThrow(/overrideSyncValue/);
    const document = await create.saveX();
    expect(document).toMatchObject({
      syncValue: "constructor",
      asyncValue: "provided",
    });
    expect(syncDefault).not.toHaveBeenCalled();
    expect(asyncDefault).not.toHaveBeenCalled();

    const edit = new EditDocumentActionBase(viewer, document, {
      title: "Edited",
    });
    expect(() => edit.builder.updateInput({ syncValue: "forbidden" })).toThrow(
      /overrideSyncValue/,
    );
    edit.builder.overrideSyncValue(" OVERRIDDEN ");
    expect((await edit.saveX()).syncValue).toBe("overridden");
  } finally {
    syncDefault.mockRestore();
    asyncDefault.mockRestore();
  }
});

test("constructor ownership still passes through action privacy", async () => {
  const viewer = await createViewer();
  const other = await createViewer();
  await expect(
    new CreateDocumentActionBase(viewer, {
      title: "Forged",
      ownerId: other.viewerID,
    }).saveX(),
  ).rejects.toThrow(/permission/);
});

test("edit-to-insert initializes defaults while keeping public immutable setters guarded", async () => {
  const viewer = await createViewer();
  const existing = await new CreateDocumentActionBase(viewer, {
    title: "Original",
  }).saveX();
  class EditAsCreate extends EditDocumentActionBase {
    transformWrite() {
      return { op: SQLStatementOperation.Insert };
    }
    getTriggers() {
      return [
        {
          changeset: (builder: this["builder"]) => {
            expect(builder.getNewOwnerIdValue()).toBe(viewer.viewerID);
            builder.overrideSyncValue(" TRIGGER INSERT ");
          },
        },
      ];
    }
  }
  const action = new EditAsCreate(viewer, existing, {
    title: "Transformed insert",
  });
  // Existing edit-to-insert persistence retains existingEnt; validate initialization only.
  await action.validX();
  expect(action.builder.orchestrator.getValidatedFields()).toMatchObject({
    owner_id: viewer.viewerID,
    sync_value: "trigger insert",
    async_value: "async",
  });
  expect(() => action.builder.updateInput({ syncValue: "forbidden" })).toThrow(
    /overrideSyncValue/,
  );
});

test("insert-to-edit rejects immutable edit defaults and preserves constructor input", async () => {
  const viewer = await createViewer();
  const existing = await new CreateDocumentActionBase(viewer, {
    title: "Original",
  }).saveX();
  class CreateAsEdit extends CreateDocumentActionBase {
    transformWrite() {
      return { op: SQLStatementOperation.Update, existingEnt: existing };
    }
  }
  const field = DocumentSchema.fields.syncValue;
  const previousDefault = field.defaultValueOnEdit;
  field.defaultValueOnEdit = () => " EDIT DEFAULT ";
  try {
    await expect(
      new CreateAsEdit(viewer, { title: "Rejected" }).validX(),
    ).rejects.toThrow(/overrideSyncValue/);
    const action = new CreateAsEdit(viewer, {
      title: "Edited",
      syncValue: " CREATE INPUT ",
    });
    await action.validX();
    expect(() =>
      action.builder.updateInput({ syncValue: "forbidden" }),
    ).toThrow(/overrideSyncValue/);
    expect(await action.saveX()).toMatchObject({
      id: existing.id,
      title: "Edited",
      syncValue: "create input",
    });
  } finally {
    field.defaultValueOnEdit = previousDefault;
  }
});
