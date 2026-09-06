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
import { EdgeType, NodeType } from "./ent/generated/types";
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

test("creation defaults reach hooks and persist with inverse edges", async () => {
  const viewer = await createViewer();
  class HookedCreate extends CreateDocumentActionBase {
    getTriggers() {
      return [
        {
          changeset: (
            builder: this["builder"],
            input: ReturnType<this["getInput"]>,
          ) => {
            // Hook arguments stay unchanged; defaults live on the builder.
            expect(input).toEqual({ title: "Created" });
            expect(builder.getInput()).toMatchObject({
              ownerId: viewer.viewerID,
              syncValue: " SYNC ",
              asyncValue: " ASYNC ",
            });
            builder.updateInput({ syncValue: " TRIGGER VALUE " });
          },
        },
      ];
    }
    getValidators() {
      return [
        {
          validate: (builder: this["builder"]) => {
            expect(builder.getInput().ownerId).toBe(viewer.viewerID);
            expect(builder.getNewSyncValueValue()).toBe(" TRIGGER VALUE ");
          },
        },
      ];
    }
  }
  const document = await new HookedCreate(viewer, { title: "Created" }).saveX();
  expect(document).toMatchObject({
    ownerId: viewer.viewerID,
    internalOwnerId: viewer.viewerID,
    syncValue: "trigger value",
    asyncValue: "async",
  });
  await expectEdges(viewer, document);
});

test("creation assignments win over defaults; edits require explicit overrides", async () => {
  const viewer = await createViewer();
  const previousOwner = await createViewer();
  const associated = await createViewer();
  const syncDefault = jest.spyOn(
    DocumentSchema.fields.syncValue,
    "defaultValueOnCreate",
  );
  const asyncDefault = jest.spyOn(
    DocumentSchema.fields.asyncValue,
    "defaultValueOnCreate",
  );
  const create = new CreateDocumentActionBase(viewer, {
    title: "Created",
    ownerId: previousOwner.viewerID,
    syncValue: " CONSTRUCTOR ",
  });
  create.builder.updateInput({ asyncValue: " SETTER " });
  create.builder.orchestrator.addInboundEdge(
    associated.viewerID,
    EdgeType.UserToDocuments,
    NodeType.User,
    { data: "explicit association" },
  );
  await create.builder.orchestrator.getEditedData();
  create.builder.updateInput({ ownerId: viewer.viewerID });
  await create.validX();
  create.builder.orchestrator.addInboundEdge(
    viewer.viewerID,
    EdgeType.UserToDocuments,
    NodeType.User,
    { data: "explicit owner association" },
  );
  const document = await create.saveX();
  expect(document).toMatchObject({
    ownerId: viewer.viewerID,
    syncValue: "constructor",
    asyncValue: "setter",
  });
  expect(
    await loadEdges({
      id1: previousOwner.viewerID,
      edgeType: EdgeType.UserToDocuments,
    }),
  ).toHaveLength(0);
  expect(
    await loadEdges({
      id1: associated.viewerID,
      edgeType: EdgeType.UserToDocuments,
    }),
  ).toEqual([
    expect.objectContaining({
      id2: document.id,
      data: "explicit association",
    }),
  ]);
  await expectEdges(viewer, document);
  expect(
    await loadEdges({
      id1: viewer.viewerID,
      edgeType: EdgeType.UserToDocuments,
    }),
  ).toEqual([
    expect.objectContaining({
      id2: document.id,
      data: "explicit owner association",
    }),
  ]);
  expect(syncDefault).not.toHaveBeenCalled();
  expect(asyncDefault).not.toHaveBeenCalled();

  const edit = new EditDocumentActionBase(viewer, document, {
    title: "Edited",
  });
  edit.builder.overrideSyncValue(" OVERRIDDEN ");
  expect(() => edit.builder.updateInput({ syncValue: "forbidden" })).toThrow(
    /overrideSyncValue/,
  );
  expect((await edit.saveX()).syncValue).toBe("overridden");
});

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

test.each([
  ["action policy", CreateDocumentActionBase],
  ["unsafe-ent helper", CustomPrivacyCreate],
] as const)("%s rejects an owner changed after defaults were cached", async (_, CreateAction) => {
  const viewer = await createViewer();
  const other = await createViewer();
  const action = new CreateAction(viewer, { title: "Forged" });
  const id = (await action.builder.orchestrator.getEditedData()).id;
  action.builder.updateInput({ ownerId: other.viewerID });
  await expect(action.saveX()).rejects.toThrow(
    /does not have permission to create/,
  );
  expect(await Document.loadRawData(id)).toBeNull();
  for (const [edgeType] of edgeTables) {
    expect(await loadEdges({ id1: viewer.viewerID, edgeType })).toHaveLength(0);
    expect(await loadEdges({ id1: other.viewerID, edgeType })).toHaveLength(0);
  }
});

test("create-to-edit preserves creation input and applies existing edit guards", async () => {
  const viewer = await createViewer();
  const existing = await new CreateDocumentActionBase(viewer, {
    title: "Original",
  }).saveX();
  const createDefault = jest.spyOn(
    DocumentSchema.fields.asyncValue,
    "defaultValueOnCreate",
  );
  class CreateAsEdit extends CreateDocumentActionBase {
    transformWrite() {
      return {
        op: SQLStatementOperation.Update,
        existingEnt: existing,
        data: { title: "Transformed edit" },
      };
    }
  }
  // Creation input has always carried through transforms, even for immutable
  // fields. This fix does not add a new policy for that existing contract.
  const action = new CreateAsEdit(viewer, {
    title: "Requested edit",
    ownerId: existing.ownerId,
    syncValue: " CREATE INPUT ",
  });
  const transform = jest.spyOn(action, "transformWrite");
  await action.builder.orchestrator.getEditedData();
  expect(() =>
    action.builder.updateInput({ ownerId: viewer.viewerID }),
  ).toThrow(/overrideOwnerId/);
  expect(await action.saveX()).toMatchObject({
    id: existing.id,
    title: "Transformed edit",
    ownerId: existing.ownerId,
    syncValue: "create input",
  });
  expect(createDefault).not.toHaveBeenCalled();
  expect(transform).toHaveBeenCalledTimes(1);
});

test("edit-to-insert uses creation defaults and allows creation setters", async () => {
  const viewer = await createViewer();
  const previousOwner = await createViewer();
  const existing = await new CreateDocumentActionBase(viewer, {
    title: "Original",
  }).saveX();
  class EditAsCreate extends EditDocumentActionBase {
    transformWrite() {
      this.builder.overrideOwnerId(viewer.viewerID);
      return { op: SQLStatementOperation.Insert };
    }
    getTriggers() {
      return [
        {
          changeset: (builder: this["builder"]) => {
            expect(builder.getNewOwnerIdValue()).toBe(viewer.viewerID);
            builder.updateInput({ syncValue: " TRIGGER INSERT " });
          },
        },
      ];
    }
  }
  const action = new EditAsCreate(viewer, existing, {
    title: "Transformed insert",
  });
  action.builder.overrideOwnerId(previousOwner.viewerID);
  // Only initialization is covered here; existing edit-to-insert persistence
  // retains existingEnt in EditNodeOperation and is outside this fix.
  await action.validX();
  expect(
    action.builder.orchestrator
      .getInputEdges(EdgeType.UserToDocuments, WriteOperation.Insert)
      .map((edge) => edge.id),
  ).toEqual([viewer.viewerID]);
  expect(action.builder.orchestrator.getValidatedFields()).toMatchObject({
    owner_id: viewer.viewerID,
    sync_value: "trigger insert",
    async_value: "async",
  });
});

test.each([
  true,
  false,
])("creation assignments in transformWrite retain precedence (returns transform: %s)", async (returnsTransform) => {
  const viewer = await createViewer();
  const previousOwner = await createViewer();
  const syncDefault = jest.spyOn(
    DocumentSchema.fields.syncValue,
    "defaultValueOnCreate",
  );
  class AssignDuringCreate extends CreateDocumentActionBase {
    async transformWrite() {
      await Promise.resolve();
      this.builder.updateInput({
        ownerId: viewer.viewerID,
        syncValue: " ASSIGNED DURING TRANSFORM ",
      });
      return returnsTransform ? { op: SQLStatementOperation.Insert } : null;
    }
  }
  const document = await new AssignDuringCreate(viewer, {
    title: "Created",
    ownerId: previousOwner.viewerID,
  }).saveX();
  expect(document.ownerId).toBe(viewer.viewerID);
  expect(document.syncValue).toBe("assigned during transform");
  expect(syncDefault).not.toHaveBeenCalled();
  expect(
    await loadEdges({
      id1: previousOwner.viewerID,
      edgeType: EdgeType.UserToDocuments,
    }),
  ).toHaveLength(0);
  await expectEdges(viewer, document);
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

test("creation assignments in a null-returning schema transform beat defaults", async () => {
  const viewer = await createViewer();
  const originalPatterns = DocumentSchema.patterns;
  DocumentSchema.patterns = [
    ...originalPatterns,
    {
      name: "assign_immutable",
      fields: {},
      transformWrite: ({ builder }) => {
        (builder as unknown as CreateDocumentActionBase["builder"]).updateInput(
          {
            syncValue: " SCHEMA ASSIGNMENT ",
          },
        );
        return null;
      },
    },
  ];
  try {
    const document = await new CreateDocumentActionBase(viewer, {
      title: "Schema transform",
    }).saveX();
    expect(document.syncValue).toBe("schema assignment");
  } finally {
    DocumentSchema.patterns = originalPatterns;
  }
});

test("shared inverse edges remain while any immutable field still needs them", async () => {
  const viewer = await createViewer();
  const previous = await createViewer();
  const action = new CreateDocumentActionBase(viewer, {
    title: "Shared inverse",
    ownerId: previous.viewerID,
    otherOwnerId: viewer.viewerID,
  });
  await action.builder.orchestrator.getEditedData();
  action.builder.updateInput({ ownerId: viewer.viewerID, otherOwnerId: null });
  const document = await action.saveX();
  expect(document).toMatchObject({
    ownerId: viewer.viewerID,
    otherOwnerId: null,
  });
  expect(
    await loadEdges({
      id1: viewer.viewerID,
      edgeType: EdgeType.UserToDocuments,
    }),
  ).toEqual([expect.objectContaining({ id2: document.id })]);
  expect(
    await loadEdges({
      id1: previous.viewerID,
      edgeType: EdgeType.UserToDocuments,
    }),
  ).toHaveLength(0);
});
