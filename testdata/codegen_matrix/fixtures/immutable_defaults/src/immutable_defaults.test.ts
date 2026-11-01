import {
  AlwaysDenyPrivacyPolicy,
  ID,
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
import { DeleteDocumentActionBase } from "./ent/generated/document/actions/delete_document_action_base";
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

test("edit-to-insert keeps typed hook context and generated accessors use the new write target", async () => {
  const viewer = await createViewer();
  const existing = await new CreateDocumentActionBase(viewer, {
    title: "Original",
    revision: 11,
  }).saveX();
  const hooks: ID[] = [];
  let newID: ID | undefined;
  class EditAsCreate extends EditDocumentActionBase {
    transformWrite() {
      return { op: SQLStatementOperation.Insert };
    }
    getTriggers() {
      return [
        {
          changeset: async (builder: this["builder"]) => {
            hooks.push(builder.existingEnt.id);
            newID = await builder.getEntID();
            expect(newID).not.toBe(existing.id);
            expect(builder.getNewRevisionValue()).toBe(7);
            expect(builder.getNewOwnerIdValue()).toBe(viewer.viewerID);
            builder.overrideSyncValue(" TRIGGER INSERT ");
          },
        },
      ];
    }
    getValidators() {
      return [
        {
          validate: (builder: this["builder"]) => {
            hooks.push(builder.existingEnt.id);
          },
        },
      ];
    }
    getObservers() {
      return [
        {
          observe: (builder: this["builder"]) => {
            hooks.push(builder.existingEnt.id);
          },
        },
      ];
    }
  }
  const action = new EditAsCreate(viewer, existing, {
    title: "Transformed insert",
    revision: 7,
  });
  const earlyID = await action.builder.getEntID();
  expect(earlyID).not.toBe(existing.id);
  await action.validX();
  expect(action.builder.orchestrator.getValidatedFields()).toMatchObject({
    owner_id: viewer.viewerID,
    sync_value: "trigger insert",
    async_value: "async",
  });
  expect(hooks).toEqual([existing.id, existing.id]);
  hooks.length = 0;
  const created = await action.saveX();
  expect(created.id).not.toBe(existing.id);
  expect(created.id).toBe(newID);
  expect(created.id).toBe(earlyID);
  expect(created.revision).toBe(7);
  expect(hooks).toEqual([existing.id, existing.id, existing.id]);
  expect(created.syncValue).toBe("trigger insert");
  await expectEdges(viewer, created);
  await expectEdges(viewer, existing);
  expect((await Document.loadX(viewer, existing.id)).title).toBe("Original");
  expect(() => action.builder.updateInput({ syncValue: "forbidden" })).toThrow(
    /overrideSyncValue/,
  );
});

test("delete-to-insert preserves non-null generated hook types and initializes new field accessors", async () => {
  const viewer = await createViewer();
  const existing = await new CreateDocumentActionBase(viewer, {
    title: "Original",
    revision: 11,
  }).saveX();
  const hooks: ID[] = [];
  let newID: ID | undefined;
  class DeleteAsCreate extends DeleteDocumentActionBase {
    transformWrite() {
      return {
        op: SQLStatementOperation.Insert,
        data: { title: "Replacement" },
      };
    }
    getTriggers() {
      return [
        {
          changeset: async (builder: this["builder"]) => {
            hooks.push(builder.existingEnt.id);
            newID = await builder.getEntID();
            expect(newID).not.toBe(existing.id);
            expect(builder.getNewTitleValue()).toBe("Replacement");
            expect(builder.getNewRevisionValue()).toBe(0);
          },
        },
      ];
    }
    getValidators() {
      return [
        {
          validate: (builder: this["builder"]) => {
            hooks.push(builder.existingEnt.id);
          },
        },
      ];
    }
    getObservers() {
      return [
        {
          observe: (builder: this["builder"]) => {
            hooks.push(builder.existingEnt.id);
          },
        },
      ];
    }
  }
  const action = new DeleteAsCreate(viewer, existing);
  const earlyID = await action.builder.getEntID();
  expect(earlyID).not.toBe(existing.id);
  await action.saveX();
  const created = await action.builder.editedEntX();
  expect(created.id).toBe(newID);
  expect(created.id).toBe(earlyID);
  expect(hooks).toEqual([existing.id, existing.id, existing.id]);
  await expectEdges(viewer, created);
  await expectEdges(viewer, existing);
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
