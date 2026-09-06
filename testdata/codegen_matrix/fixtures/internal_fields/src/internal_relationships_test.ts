import assert from "node:assert/strict";
import { IDViewer, convertNullableList } from "@snowtop/ent";
import type { ID } from "@snowtop/ent";
import { WriteOperation } from "@snowtop/ent/action";
import { SQLStatementOperation } from "@snowtop/ent/schema";
import type { Client } from "@snowtop/ent/core/db";
import { Assignment } from "./ent";
import { EdgeType } from "./ent/generated/types";
import CreateAssignmentAction from "./ent/assignment/actions/create_assignment_action";
import EditAssignmentAction from "./ent/assignment/actions/edit_assignment_action";
import DeleteAssignmentAction from "./ent/assignment/actions/delete_assignment_action";

export async function verifyInternalRelationships(
  client: Client,
  ownerA: ID,
  ownerB: ID,
) {
  await client.query(`CREATE TABLE assignments (
    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    name TEXT NOT NULL, shared_owner_id TEXT, shared_second_id TEXT, derived_owner_id TEXT, default_owner_id TEXT,
    private_owner_id TEXT, member_ids TEXT,
    editable_owner_id TEXT
  )`);
  await client.query(`CREATE TABLE assoc_edge_config (
    edge_type TEXT PRIMARY KEY, edge_name TEXT NOT NULL, symmetric_edge INTEGER NOT NULL,
    inverse_edge_type TEXT, edge_table TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`);
  await client.query(`CREATE TABLE internal_relationship_edges (
    id1 TEXT NOT NULL, id1_type TEXT NOT NULL, edge_type TEXT NOT NULL,
    id2 TEXT NOT NULL, id2_type TEXT NOT NULL, time TEXT NOT NULL, data TEXT,
    PRIMARY KEY (id1, edge_type, id2)
  )`);
  const fields = [
    {
      key: "derivedOwnerId",
      column: "derived_owner_id",
      edge: EdgeType.ContactToDerivedAssignments,
    },
    {
      key: "defaultOwnerId",
      column: "default_owner_id",
      edge: EdgeType.ContactToDefaultAssignments,
      defaults: true,
    },
    {
      key: "privateOwnerId",
      column: "private_owner_id",
      edge: EdgeType.ContactToPrivateAssignments,
    },
    {
      key: "memberIds",
      column: "member_ids",
      edge: EdgeType.ContactToMemberAssignments,
      list: true,
    },
    {
      key: "editableOwnerId",
      column: "editable_owner_id",
      edge: EdgeType.ContactToEditableAssignments,
    },
  ];
  for (const field of fields) {
    await client.query(
      `INSERT INTO assoc_edge_config
      (edge_type, edge_name, symmetric_edge, inverse_edge_type, edge_table, created_at, updated_at)
      VALUES (?, ?, 0, NULL, 'internal_relationship_edges', ?, ?) RETURNING edge_type`,
      [field.edge, field.key, new Date(), new Date()],
    );
  }
  const viewer = new IDViewer(ownerA);
  const reload = (id: ID) => Assignment.loadX(viewer, id);

  for (const field of fields) {
    const value = (id: ID) => (field.list ? [id] : id);
    const assertStored = async (id: ID, expected: ID[] | null) => {
      const rows = await client.queryAll(
        "SELECT id1 FROM internal_relationship_edges WHERE edge_type = ? AND id2 = ? ORDER BY id1",
        [field.edge, id],
      );
      assert.deepEqual(
        rows.rows.map((row) => row.id1),
        [...(expected ?? [])].sort(),
        `${field.key}: reverse rows`,
      );
      const raw = await Assignment.loadRawDataX(id);
      const stored = raw[field.column];
      assert.deepEqual(
        field.list ? convertNullableList(stored) : stored,
        field.list ? expected : (expected?.[0] ?? null),
        `${field.key}: stored field`,
      );
    };
    // These cases exercise emitted field selection and stored-ID normalization.
    // Runtime reconciliation combinations live in orchestrator_field_edges.test.ts.
    const create = CreateAssignmentAction.create(viewer, { name: field.key });
    if (!field.defaults)
      create.builder.updateInput({ [field.key]: value(ownerA) });
    await create.builder.orchestrator.getEditedData();
    create.builder.storeData("relationshipOverride", {
      [field.key]: value(ownerB),
    });
    const created = await create.saveX();
    if (field.defaults) {
      assert.deepEqual(
        create.builder.getStoredData("defaultOwnersBeforeTrigger"),
        [ownerA],
      );
    }
    await assertStored(created.id, [ownerB]);

    const edit = EditAssignmentAction.create(
      viewer,
      await reload(created.id),
      {},
    );
    edit.builder.updateInput({ [field.key]: value(ownerA) });
    await edit.saveX();
    await assertStored(created.id, [ownerA]);

    const clear = EditAssignmentAction.create(
      viewer,
      await reload(created.id),
      {},
    );
    clear.builder.updateInput({ [field.key]: null });
    await clear.saveX();
    await assertStored(created.id, null);
    if (field.list) {
      const members = EditAssignmentAction.create(
        viewer,
        await reload(created.id),
        {},
      );
      members.builder.updateInput({ memberIds: [ownerA, ownerB] });
      await members.saveX();
      await assertStored(created.id, [ownerA, ownerB]);
      const empty = EditAssignmentAction.create(
        viewer,
        await reload(created.id),
        {},
      );
      empty.builder.updateInput({ memberIds: [] });
      await empty.saveX();
      await assertStored(created.id, []);
    }
    const restore = EditAssignmentAction.create(
      viewer,
      await reload(created.id),
      {},
    );
    restore.builder.updateInput({ [field.key]: value(ownerA) });
    await restore.saveX();
    await DeleteAssignmentAction.create(
      viewer,
      await reload(created.id),
    ).saveX();
    assert.equal(await Assignment.load(viewer, created.id), null);
    const remaining = await client.queryAll(
      "SELECT * FROM internal_relationship_edges WHERE id2 = ?",
      [created.id],
    );
    assert.equal(remaining.rows.length, 0);
    console.log(
      `PASS: generated ${field.key} persists values and supplies stored inverse IDs`,
    );
  }

  // Distinct generated field names must register separate contributions.
  const shared = EdgeType.ContactToSharedAssignments;
  await client.query(
    `INSERT INTO assoc_edge_config
    (edge_type, edge_name, symmetric_edge, inverse_edge_type, edge_table, created_at, updated_at)
    VALUES (?, 'sharedAssignments', 0, NULL, 'internal_relationship_edges', ?, ?) RETURNING edge_type`,
    [shared, new Date(), new Date()],
  );
  const sharedCreate = CreateAssignmentAction.create(viewer, {
    name: "shared fields",
  });
  sharedCreate.builder.updateInput({
    sharedOwnerId: ownerA,
    sharedSecondId: ownerB,
  });
  const sharedEnt = await sharedCreate.saveX();
  const createdSharedRows = await client.queryAll(
    "SELECT id1 FROM internal_relationship_edges WHERE id2 = ? AND edge_type = ? ORDER BY id1",
    [sharedEnt.id, shared],
  );
  assert.deepEqual(
    createdSharedRows.rows.map((row) => row.id1),
    [ownerA, ownerB].sort(),
  );
  const sharedEdit = EditAssignmentAction.create(
    viewer,
    await reload(sharedEnt.id),
    {},
  );
  sharedEdit.builder.updateInput({ sharedOwnerId: null });
  await sharedEdit.saveX();
  const sharedRows = await client.queryAll(
    "SELECT id1 FROM internal_relationship_edges WHERE id2 = ? AND edge_type = ?",
    [sharedEnt.id, shared],
  );
  assert.deepEqual(
    sharedRows.rows.map((row) => row.id1),
    [ownerB],
  );

  // The generated private accessor hides this value, so transformed writes need
  // emitted raw-data loading before defaults and triggers observe inverse IDs.
  const seed = CreateAssignmentAction.create(viewer, {
    name: "private stored owner",
  });
  seed.builder.updateInput({ defaultOwnerId: ownerB });
  const existing = await reload((await seed.saveX()).id);
  class CreateAsEdit extends CreateAssignmentAction {
    transformWrite() {
      return { op: SQLStatementOperation.Update, existingEnt: existing };
    }
    getTriggers() {
      return [
        {
          changeset: (builder: this["builder"]) => {
            assert.deepEqual(
              builder.orchestrator
                .getInputEdges(
                  EdgeType.ContactToDefaultAssignments,
                  WriteOperation.Delete,
                )
                .map((edge) => edge.id),
              [ownerB],
            );
          },
        },
      ];
    }
  }
  await new CreateAsEdit(viewer, { name: "transformed private owner" }).saveX();
  assert.equal(
    (await Assignment.loadRawDataX(existing.id)).default_owner_id,
    ownerA,
  );
  const transformedRows = await client.queryAll(
    "SELECT id1 FROM internal_relationship_edges WHERE id2 = ? AND edge_type = ?",
    [existing.id, EdgeType.ContactToDefaultAssignments],
  );
  assert.deepEqual(
    transformedRows.rows.map((row) => row.id1),
    [ownerA],
  );
  console.log(
    "PASS: generated shared field registration and transformed private stored IDs",
  );
}
