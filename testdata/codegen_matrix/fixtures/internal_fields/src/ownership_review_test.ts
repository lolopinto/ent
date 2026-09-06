import assert from "node:assert/strict";
import { IDViewer } from "@snowtop/ent";
import type { ID } from "@snowtop/ent";
import type { Client } from "@snowtop/ent/core/db";
import { WriteOperation } from "@snowtop/ent/action";
import { SQLStatementOperation } from "@snowtop/ent/schema";
import { Assignment, Contact } from "./ent";
import { EdgeType, NodeType } from "./ent/generated/types";
import CreateAssignmentAction from "./ent/assignment/actions/create_assignment_action";
import EditAssignmentAction from "./ent/assignment/actions/edit_assignment_action";
import DeleteAssignmentAction from "./ent/assignment/actions/delete_assignment_action";
import CreateContactAction from "./ent/contact/actions/create_contact_action";
import EditContactAction from "./ent/contact/actions/edit_contact_action";

export async function verifyOwnership(client: Client, a: ID, b: ID, c: ID) {
  const viewer = new IDViewer(a);
  const shared = EdgeType.ContactToSharedAssignments;
  const derived = EdgeType.ContactToDerivedAssignments;
  await client.query(
    `INSERT INTO assoc_edge_config
    (edge_type, edge_name, symmetric_edge, inverse_edge_type, edge_table, created_at, updated_at)
    VALUES (?, 'sharedAssignments', 0, NULL, 'internal_relationship_edges', ?, ?) RETURNING edge_type`,
    [shared, new Date(), new Date()],
  );
  const rows = async (id: ID, edge: string) =>
    (
      await client.queryAll(
        "SELECT id1, data FROM internal_relationship_edges WHERE id2 = ? AND edge_type = ? ORDER BY id1",
        [id, edge],
      )
    ).rows;
  const failures: string[] = [];
  const check = async (name: string, test: () => Promise<void>) => {
    try {
      await test();
      console.log(`OWNERSHIP PASS: ${name}`);
    } catch (err) {
      failures.push(name);
      console.log(`OWNERSHIP FAIL: ${name}\n${err}`);
    }
  };

  await check("two fields sharing one inverse type", async () => {
    const action = CreateAssignmentAction.create(viewer, { name: "shared" });
    action.builder.updateInput({ sharedOwnerId: a, sharedSecondId: b });
    const ent = await action.saveX();
    const raw = await Assignment.loadRawDataX(ent.id);
    assert.equal(raw.shared_owner_id, a);
    assert.equal(raw.shared_second_id, b);
    const actual = (await rows(ent.id, shared)).map((row) => row.id1).sort();
    console.log("SHARED", JSON.stringify({ expected: [a, b].sort(), actual }));
    assert.deepEqual(actual, [a, b].sort());
  });

  await check("omitted sibling retains shared stored membership", async () => {
    const create = CreateAssignmentAction.create(viewer, {
      name: "shared edit",
    });
    create.builder.updateInput({ sharedOwnerId: a, sharedSecondId: a });
    const ent = await create.saveX();
    const edit = EditAssignmentAction.create(
      viewer,
      await Assignment.loadX(viewer, ent.id),
      {},
    );
    edit.builder.updateInput({ sharedOwnerId: b });
    await edit.saveX();
    assert.deepEqual(
      (await rows(ent.id, shared)).map((row) => row.id1).sort(),
      [a, b].sort(),
    );
    assert.equal((await Assignment.loadRawDataX(ent.id)).shared_second_id, a);
    const clear = EditAssignmentAction.create(
      viewer,
      await Assignment.loadX(viewer, ent.id),
      {},
    );
    clear.builder.updateInput({ sharedOwnerId: null });
    await clear.saveX();
    assert.deepEqual(
      (await rows(ent.id, shared)).map((row) => row.id1),
      [a],
    );
    await DeleteAssignmentAction.create(
      viewer,
      await Assignment.loadX(viewer, ent.id),
    ).saveX();
    assert.deepEqual(await rows(ent.id, shared), []);
  });

  await check(
    "delete transformed to edit retracts generated removals before triggers",
    async () => {
      const seed = CreateAssignmentAction.create(viewer, { name: "retained" });
      seed.builder.updateInput({ derivedOwnerId: a });
      const ent = await seed.saveX();
      class DeleteAsEdit extends DeleteAssignmentAction {
        transformWrite() {
          return {
            op: SQLStatementOperation.Update,
            data: { name: "still present" },
          };
        }
        getTriggers() {
          return [
            {
              changeset: (builder: this["builder"]) => {
                assert.deepEqual(
                  builder.orchestrator.getInputEdges(
                    derived,
                    WriteOperation.Delete,
                  ),
                  [],
                );
              },
            },
          ];
        }
      }
      await new DeleteAsEdit(
        viewer,
        await Assignment.loadX(viewer, ent.id),
      ).saveX();
      assert.equal(
        (await Assignment.loadRawDataX(ent.id)).name,
        "still present",
      );
      assert.deepEqual(
        (await rows(ent.id, derived)).map((row) => row.id1),
        [a],
      );
    },
  );

  await check(
    "create transformed to edit refreshes private stored IDs before defaults",
    async () => {
      const seed = CreateAssignmentAction.create(viewer, {
        name: "old private owner",
      });
      seed.builder.updateInput({ defaultOwnerId: b });
      const ent = await seed.saveX();
      const existing = await Assignment.loadX(viewer, ent.id);
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
                  [b],
                );
              },
            },
          ];
        }
      }
      await new CreateAsEdit(viewer, { name: "new private owner" }).saveX();
      assert.equal((await Assignment.loadRawDataX(ent.id)).default_owner_id, a);
      assert.deepEqual(
        (await rows(ent.id, EdgeType.ContactToDefaultAssignments)).map(
          (row) => row.id1,
        ),
        [a],
      );
    },
  );

  await check("manual stored endpoint survives field replacement", async () => {
    const seed = CreateAssignmentAction.create(viewer, {
      name: "manual stored insert",
    });
    seed.builder.updateInput({ derivedOwnerId: a });
    const ent = await seed.saveX();
    const edit = EditAssignmentAction.create(
      viewer,
      await Assignment.loadX(viewer, ent.id),
      {},
    );
    edit.builder.updateInput({ derivedOwnerId: a });
    await edit.builder.orchestrator.getEditedData();
    edit.builder.orchestrator.addInboundEdge(a, derived, NodeType.Contact, {
      data: "explicit-stored",
    });
    edit.builder.storeData("relationshipOverride", { derivedOwnerId: b });
    await edit.saveX();
    const actual = await rows(ent.id, derived);
    assert.deepEqual(actual.map((row) => row.id1).sort(), [a, b].sort());
    assert.equal(actual.find((row) => row.id1 === a)?.data, "explicit-stored");
  });

  await check(
    "manual same-ID insertion survives field replacement",
    async () => {
      const seed = CreateAssignmentAction.create(viewer, {
        name: "manual insert",
      });
      seed.builder.updateInput({ derivedOwnerId: a });
      const ent = await seed.saveX();
      const edit = EditAssignmentAction.create(
        viewer,
        await Assignment.loadX(viewer, ent.id),
        {},
      );
      edit.builder.updateInput({ derivedOwnerId: b });
      await edit.builder.orchestrator.getEditedData();
      edit.builder.orchestrator.addInboundEdge(b, derived, NodeType.Contact, {
        data: "explicit-manual",
      });
      edit.builder.storeData("relationshipOverride", { derivedOwnerId: c });
      await edit.saveX();
      assert.equal((await Assignment.loadRawDataX(ent.id)).derived_owner_id, c);
      const actual = await rows(ent.id, derived);
      console.log(
        "MANUAL_INSERT",
        JSON.stringify({ expectedIDs: [b, c].sort(), actual }),
      );
      assert.deepEqual(actual.map((row) => row.id1).sort(), [b, c].sort());
      assert.equal(
        actual.find((row) => row.id1 === b)?.data,
        "explicit-manual",
      );
    },
  );

  await check("manual same-ID removal survives restoring field", async () => {
    const seed = CreateAssignmentAction.create(viewer, {
      name: "manual remove",
    });
    seed.builder.updateInput({ derivedOwnerId: a });
    const ent = await seed.saveX();
    const edit = EditAssignmentAction.create(
      viewer,
      await Assignment.loadX(viewer, ent.id),
      {},
    );
    edit.builder.updateInput({ derivedOwnerId: b });
    await edit.builder.orchestrator.getEditedData();
    edit.builder.orchestrator.removeInboundEdge(a, derived);
    edit.builder.storeData("relationshipOverride", { derivedOwnerId: a });
    await edit.validX();
    const actual = edit.builder.orchestrator
      .getInputEdges(derived, WriteOperation.Delete)
      .map((edge) => edge.id);
    console.log("MANUAL_REMOVE", JSON.stringify({ expected: [a], actual }));
    assert.deepEqual(actual, [a]);
    await edit.saveX();
    assert.equal((await Assignment.loadRawDataX(ent.id)).derived_owner_id, a);
    assert.deepEqual(await rows(ent.id, derived), []);
  });
  await check(
    "manual deletion wins over existing builder endpoint",
    async () => {
      const seed = CreateAssignmentAction.create(viewer, {
        name: "builder endpoint",
      });
      seed.builder.updateInput({ derivedOwnerId: a });
      const ent = await seed.saveX();
      const owner = EditContactAction.create(
        viewer,
        await Contact.loadX(viewer, a),
        {
          name: "still same owner",
        },
      );
      class AssignmentWithOwnerEdit extends EditAssignmentAction {
        getTriggers() {
          return [{ changeset: () => owner.changeset() }];
        }
      }
      const edit = new AssignmentWithOwnerEdit(viewer, ent, {});
      edit.builder.updateInput({ derivedOwnerId: owner.builder });
      edit.builder.orchestrator.removeInboundEdge(a, derived);
      await edit.saveX();
      assert.equal((await Assignment.loadRawDataX(ent.id)).derived_owner_id, a);
      assert.deepEqual(await rows(ent.id, derived), []);
    },
  );

  await check(
    "manual existing-builder insertion survives field replacement",
    async () => {
      const seed = CreateAssignmentAction.create(viewer, {
        name: "manual builder",
      });
      seed.builder.updateInput({ derivedOwnerId: a });
      const ent = await seed.saveX();
      const owner = EditContactAction.create(
        viewer,
        await Contact.loadX(viewer, a),
        {
          name: "manual owner",
        },
      );
      class AssignmentWithOwnerEdit extends EditAssignmentAction {
        getTriggers() {
          return [{ changeset: () => owner.changeset() }];
        }
      }
      const edit = new AssignmentWithOwnerEdit(viewer, ent, {});
      edit.builder.updateInput({ derivedOwnerId: b });
      edit.builder.orchestrator.addInboundEdge(
        owner.builder,
        derived,
        NodeType.Contact,
        {
          data: "manual-existing-builder",
        },
      );
      await edit.saveX();
      assert.equal((await Assignment.loadRawDataX(ent.id)).derived_owner_id, b);
      assert.deepEqual(
        await rows(ent.id, derived),
        [
          { id1: a, data: "manual-existing-builder" },
          { id1: b, data: null },
        ].sort((x, y) => String(x.id1).localeCompare(String(y.id1))),
      );
    },
  );

  for (const manualBuilder of [false, true]) {
    await check(
      `manual insert options survive scalar/builder aliases (${manualBuilder})`,
      async () => {
        const owner = EditContactAction.create(
          viewer,
          await Contact.loadX(viewer, a),
          {
            name: "aliased owner",
          },
        );
        class AssignmentWithOwnerEdit extends CreateAssignmentAction {
          getTriggers() {
            return [{ changeset: () => owner.changeset() }];
          }
        }
        const action = new AssignmentWithOwnerEdit(viewer, {
          name: "aliased endpoint",
        });
        action.builder.updateInput({
          derivedOwnerId: manualBuilder ? a : owner.builder,
        });
        action.builder.orchestrator.addInboundEdge(
          manualBuilder ? owner.builder : a,
          derived,
          NodeType.Contact,
          {
            data: "manual-alias",
          },
        );
        const ent = await action.saveX();
        assert.equal(
          (await Assignment.loadRawDataX(ent.id)).derived_owner_id,
          a,
        );
        assert.deepEqual(await rows(ent.id, derived), [
          { id1: a, data: "manual-alias" },
        ]);
      },
    );
  }

  await check(
    "new builders retain distinct dependencies and shared ownership",
    async () => {
      const first = CreateContactAction.create(viewer, {
        name: "first new owner",
      });
      const second = CreateContactAction.create(viewer, {
        name: "second new owner",
      });
      class AssignmentWithNewOwners extends CreateAssignmentAction {
        getTriggers() {
          return [
            { changeset: () => first.changeset() },
            { changeset: () => second.changeset() },
          ];
        }
      }
      const action = new AssignmentWithNewOwners(viewer, {
        name: "new owners",
      });
      action.builder.updateInput({
        sharedOwnerId: first.builder,
        sharedSecondId: first.builder,
      });
      action.builder.orchestrator.addInboundEdge(
        first.builder,
        shared,
        NodeType.Contact,
        { data: "manual-new-builder" },
      );
      action.builder.updateInput({ sharedOwnerId: second.builder });
      const ent = await action.saveX();
      const firstID = (await first.builder.editedEntX()).id;
      const secondID = (await second.builder.editedEntX()).id;
      const raw = await Assignment.loadRawDataX(ent.id);
      assert.equal(raw.shared_owner_id, secondID);
      assert.equal(raw.shared_second_id, firstID);
      assert.deepEqual(
        await rows(ent.id, shared),
        [
          { id1: firstID, data: "manual-new-builder" },
          { id1: secondID, data: null },
        ].sort((x, y) => String(x.id1).localeCompare(String(y.id1))),
      );
    },
  );
  for (const operation of ["create", "edit"] as const) {
    for (const reset of ["delete", "undefined", "null", "override"] as const) {
      await check(
        `${operation} default fallback after trigger ${reset}`,
        async () => {
          const resetInput = (
            builder:
              | CreateAssignmentAction["builder"]
              | EditAssignmentAction["builder"],
          ) => {
            if (reset === "delete") builder.deleteInputKey("defaultOwnerId");
            else
              builder.updateInput({
                defaultOwnerId:
                  reset === "undefined"
                    ? undefined
                    : reset === "null"
                      ? null
                      : c,
              });
          };
          class CreateWithReset extends CreateAssignmentAction {
            getTriggers() {
              return [{ changeset: resetInput }];
            }
          }
          class EditWithReset extends EditAssignmentAction {
            getTriggers() {
              return [{ changeset: resetInput }];
            }
          }
          let ent: Assignment;
          if (operation === "create") {
            ent = await new CreateWithReset(viewer, {
              name: `default reset ${reset}`,
            }).saveX();
          } else {
            const seed = await CreateAssignmentAction.create(new IDViewer(b), {
              name: "old default owner",
            }).saveX();
            ent = await new EditWithReset(viewer, seed, {
              name: `edited default reset ${reset}`,
            }).saveX();
          }
          const expected =
            reset === "null" ? null : reset === "override" ? c : a;
          assert.equal(
            (await Assignment.loadRawDataX(ent.id)).default_owner_id,
            expected,
          );
          assert.deepEqual(
            await rows(ent.id, EdgeType.ContactToDefaultAssignments),
            expected === null ? [] : [{ id1: expected, data: null }],
          );
        },
      );
    }
  }

  await check(
    "cleared edit defaults do not change an otherwise empty edit",
    async () => {
      const seed = await CreateAssignmentAction.create(new IDViewer(b), {
        name: "unchanged default",
      }).saveX();
      class EmptyEdit extends EditAssignmentAction {
        getTriggers() {
          return [
            {
              changeset: (builder: this["builder"]) => {
                builder.deleteInputKey("defaultOwnerId");
                builder.deleteInputKey("updatedAt");
              },
            },
          ];
        }
      }
      await new EmptyEdit(viewer, seed, {}).saveX();
      assert.equal(
        (await Assignment.loadRawDataX(seed.id)).default_owner_id,
        b,
      );
      assert.deepEqual(
        await rows(seed.id, EdgeType.ContactToDefaultAssignments),
        [{ id1: b, data: null }],
      );
    },
  );
  assert.deepEqual(failures, [], "ownership regressions");
}
