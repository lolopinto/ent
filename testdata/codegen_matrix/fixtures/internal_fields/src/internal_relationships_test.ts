import assert from "node:assert/strict";
import { IDViewer, convertNullableList } from "@snowtop/ent";
import type { ID } from "@snowtop/ent";
import { WriteOperation } from "@snowtop/ent/action";
import type { Client } from "@snowtop/ent/core/db";
import { Assignment } from "./ent";
import { EdgeType } from "./ent/generated/types";
import type { AssignmentBuilder } from "./ent/generated/assignment/actions/assignment_builder";
import CreateAssignmentAction from "./ent/assignment/actions/create_assignment_action";
import EditAssignmentAction from "./ent/assignment/actions/edit_assignment_action";
import DeleteAssignmentAction from "./ent/assignment/actions/delete_assignment_action";

export async function verifyInternalRelationships(
  client: Client,
  ownerA: ID,
  ownerB: ID,
  ownerC: ID,
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
    const assertQueued = (
      builder: AssignmentBuilder,
      inserts: ID[],
      deletes: ID[],
    ) => {
      for (const [operation, expected] of [
        [WriteOperation.Insert, inserts],
        [WriteOperation.Delete, deletes],
      ] as const) {
        assert.deepEqual(
          builder.orchestrator
            .getInputEdges(field.edge, operation)
            .map((edge) => edge.id)
            .sort(),
          [...expected].sort(),
          `${field.key}: queued ${operation}`,
        );
      }
    };

    const create = CreateAssignmentAction.create(viewer, { name: field.key });
    if (!field.defaults)
      create.builder.updateInput({ [field.key]: value(ownerA) });
    // Force the first collection/default pass, then replace A in a real trigger.
    await create.builder.orchestrator.getEditedData();
    create.builder.storeData("relationshipOverride", {
      [field.key]: value(ownerB),
    });
    const created = await create.saveX();
    if (field.defaults) {
      assert.deepEqual(
        create.builder.getStoredData("defaultOwnersBeforeTrigger"),
        [ownerA],
        "default inverse edges are visible inside triggers",
      );
    }
    await assertStored(created.id, [ownerB]);
    assertQueued(create.builder, [ownerB], []);

    if (!field.defaults) {
      const omitted = EditAssignmentAction.create(
        viewer,
        await reload(created.id),
        { name: "unrelated edit" },
      );
      await omitted.saveX();
      await assertStored(created.id, [ownerB]);
      assertQueued(omitted.builder, [], []);
    }

    // A speculative edit back to A is replaced by B, the original stored owner.
    const same = EditAssignmentAction.create(
      viewer,
      await reload(created.id),
      {},
    );
    same.builder.updateInput({ [field.key]: value(ownerA) });
    await same.builder.orchestrator.getEditedData();
    same.builder.storeData("relationshipOverride", {
      [field.key]: value(ownerB),
    });
    await same.saveX();
    await assertStored(created.id, [ownerB]);
    assertQueued(same.builder, [ownerB], []);

    const replace = EditAssignmentAction.create(
      viewer,
      await reload(created.id),
      {},
    );
    replace.builder.updateInput({ [field.key]: value(ownerA) });
    await replace.saveX();
    await assertStored(created.id, [ownerA]);
    assertQueued(replace.builder, [ownerA], [ownerB]);

    const clear = EditAssignmentAction.create(
      viewer,
      await reload(created.id),
      {},
    );
    clear.builder.updateInput({ [field.key]: value(ownerB) });
    await clear.builder.orchestrator.getEditedData();
    clear.builder.storeData("relationshipOverride", { [field.key]: null });
    await clear.saveX();
    await assertStored(created.id, null);
    assertQueued(clear.builder, [], [ownerA]);

    if (field.list) {
      const members = EditAssignmentAction.create(
        viewer,
        await reload(created.id),
        {},
      );
      members.builder.updateInput({ [field.key]: [ownerC] });
      await members.builder.orchestrator.getEditedData();
      members.builder.storeData("relationshipOverride", {
        [field.key]: [ownerA, ownerB],
      });
      await members.saveX();
      await assertStored(created.id, [ownerA, ownerB]);
      assertQueued(members.builder, [ownerA, ownerB], []);

      const empty = EditAssignmentAction.create(
        viewer,
        await reload(created.id),
        {},
      );
      empty.builder.updateInput({ [field.key]: [ownerA, ownerB] });
      await empty.builder.orchestrator.getEditedData();
      empty.builder.storeData("relationshipOverride", { [field.key]: [] });
      await empty.saveX();
      await assertStored(created.id, []);
      assertQueued(empty.builder, [], [ownerA, ownerB]);
    }

    const restore = EditAssignmentAction.create(
      viewer,
      await reload(created.id),
      {},
    );
    restore.builder.updateInput({ [field.key]: value(ownerA) });
    await restore.saveX();
    const remove = DeleteAssignmentAction.create(
      viewer,
      await reload(created.id),
    );
    // Even a DELETE trigger assigning another owner must not create a dangling edge.
    remove.builder.storeData("relationshipOverride", {
      [field.key]: value(ownerB),
    });
    await remove.saveX();
    assert.equal(await Assignment.load(viewer, created.id), null);
    const rows = await client.queryAll(
      "SELECT * FROM internal_relationship_edges WHERE id2 = ?",
      [created.id],
    );
    assert.equal(
      rows.rows.length,
      0,
      `${field.key}: delete leaves no reverse edges`,
    );
    assertQueued(remove.builder, [], [ownerA]);
    console.log(
      `PASS: ${field.key} inverse rows follow final create/edit/clear/delete values`,
    );

    const seed = CreateAssignmentAction.create(viewer, {
      name: "enriched",
    });
    if (!field.defaults)
      seed.builder.updateInput({ [field.key]: value(ownerA) });
    const seeded = await seed.saveX();
    const enriched = EditAssignmentAction.create(
      viewer,
      await reload(seeded.id),
      {},
    );
    if (!field.defaults)
      enriched.builder.updateInput({ [field.key]: value(ownerA) });
    enriched.builder.storeData("enrichRelationship", {
      edgeType: field.edge,
      manualOwner: ownerB,
      removedOwner: ownerC,
    });
    const withData = await enriched.saveX();
    assertQueued(enriched.builder, [ownerA, ownerB], [ownerC]);
    const enrichedRows = await client.queryAll(
      "SELECT id1, data FROM internal_relationship_edges WHERE id2 = ? AND edge_type = ? ORDER BY id1",
      [withData.id, field.edge],
    );
    assert.deepEqual(
      enrichedRows.rows,
      [
        { id1: ownerA, data: "enriched" },
        { id1: ownerB, data: "manual" },
      ].sort((a, b) => String(a.id1).localeCompare(String(b.id1))),
      `${field.key}: retain trigger enrichment and unrelated manual edges`,
    );
    console.log(
      `PASS: ${field.key} preserves trigger edge data and unrelated manual operations`,
    );
  }
}
