import { IDViewer, LoggedOutViewer } from "@snowtop/ent";
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

// Detailed privacy, transform, and edge bookkeeping cases live in ts/src/action.
// These checks exercise generated setters, accessors, and field-edge wiring.
test("generated creation defaults reach hooks and inverse edges", async () => {
  const viewer = await createViewer();
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
            expect(builder.getNewSyncValueValue()).toBe(" SYNC ");
            builder.updateInput({ syncValue: " TRIGGER VALUE " });
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

test("generated creation setters accept immutable inputs; edits require overrides", async () => {
  const viewer = await createViewer();
  const create = new CreateDocumentActionBase(viewer, {
    title: "Created",
    syncValue: " CONSTRUCTOR ",
  });
  create.builder.updateInput({ asyncValue: " SETTER " });
  const document = await create.saveX();
  expect(document).toMatchObject({
    syncValue: "constructor",
    asyncValue: "setter",
  });

  const edit = new EditDocumentActionBase(viewer, document, {
    title: "Edited",
  });
  edit.builder.overrideSyncValue(" OVERRIDDEN ");
  expect(() => edit.builder.updateInput({ syncValue: "forbidden" })).toThrow(
    /overrideSyncValue/,
  );
  expect((await edit.saveX()).syncValue).toBe("overridden");
});

test("generated create-to-edit guards use the effective operation", async () => {
  const viewer = await createViewer();
  const existing = await new CreateDocumentActionBase(viewer, {
    title: "Original",
  }).saveX();
  class CreateAsEdit extends CreateDocumentActionBase {
    transformWrite() {
      return { op: SQLStatementOperation.Update, existingEnt: existing };
    }
  }
  const action = new CreateAsEdit(viewer, {
    title: "Edited",
    syncValue: " CREATE INPUT ",
  });
  await action.builder.orchestrator.getEditedData();
  expect(() =>
    action.builder.updateInput({ ownerId: viewer.viewerID }),
  ).toThrow(/overrideOwnerId/);
  expect(await action.saveX()).toMatchObject({
    id: existing.id,
    title: "Edited",
    syncValue: "create input",
  });
});

test("generated edit-to-insert guards allow creation setters", async () => {
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
            builder.updateInput({ syncValue: " TRIGGER INSERT " });
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
    sync_value: "trigger insert",
  });
});

test.each([
  "cached initialization",
  "transformWrite",
])("generated field edges follow reassignment during %s", async (stage) => {
  const viewer = await createViewer();
  const previous = await createViewer();
  const associated = await createViewer();
  class ReassignOwner extends CreateDocumentActionBase {
    transformWrite() {
      if (stage === "transformWrite") {
        this.builder.updateInput({
          ownerId: viewer.viewerID,
          otherOwnerId: null,
        });
      }
      return null;
    }
  }
  const action = new ReassignOwner(viewer, {
    title: "Shared inverse",
    ownerId: previous.viewerID,
    otherOwnerId: viewer.viewerID,
  });
  action.builder.orchestrator.addInboundEdge(
    associated.viewerID,
    EdgeType.UserToDocuments,
    NodeType.User,
    { data: "explicit association" },
  );
  await action.builder.orchestrator.getEditedData();
  if (stage === "cached initialization") {
    action.builder.updateInput({
      ownerId: viewer.viewerID,
      otherOwnerId: null,
    });
  }
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
  expect(
    await loadEdges({
      id1: associated.viewerID,
      edgeType: EdgeType.UserToDocuments,
    }),
  ).toEqual([
    expect.objectContaining({ id2: document.id, data: "explicit association" }),
  ]);
});
