import fs from "fs";
import path from "path";
import vm from "vm";
import ts from "typescript";
import DB from "../core/db";
import * as actionRuntime from "./index";
import { withTransaction } from "./index";
import {
  setupPostgres,
  assoc_edge_config_table,
} from "../testutils/db/temp_db";
import { TestContext } from "../testutils/context/test_context";

type GeneratedMethod = (...args: unknown[]) => Promise<unknown>;
interface GeneratedEdgeGroup {
  save: GeneratedMethod;
  saveX: GeneratedMethod;
  changeset: GeneratedMethod;
  changesetWithOptions_BETA: GeneratedMethod;
  valid: GeneratedMethod;
  validX: GeneratedMethod;
}

// Load the generated methods as a consumer fixture without starting the example.
// Their edge setup and transaction boundaries call the local package runtime.
const source = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../../examples/simple/src/ent/generated/event/actions/edit_event_rsvp_status_action_base.ts",
  ),
  "utf8",
);
const emitted = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const generated = {} as {
  EditEventRsvpStatusActionBase: { prototype: GeneratedEdgeGroup };
};
vm.runInNewContext(emitted, {
  exports: generated,
  require: (name: string) =>
    name === "@snowtop/ent/action"
      ? actionRuntime
      : name.endsWith("/types")
        ? { NodeType: { User: "User" } }
        : {},
});

function action(): GeneratedEdgeGroup {
  return Object.assign(
    Object.create(generated.EditEventRsvpStatusActionBase.prototype),
    {
      builder: { orchestrator: { viewer: new TestContext().getViewer() } },
      input: {
        rsvpStatus: "attending",
        userId: "f4a78b60-ddc3-43e2-b34d-a4e540f60680",
      },
      event: {
        id: "e1cddfe5-39c5-4bdc-8ea1-296efb0e41c15",
        getEventRsvpStatusMap: () =>
          new Map([["attending", "a9d4f039-9e3b-4571-8fc1-0bd1ac531cf7"]]),
      },
    },
  );
}

setupPostgres(() => [assoc_edge_config_table()]);
beforeEach(async () => {
  await DB.getInstance()
    .getPool()
    .query("CREATE TABLE generated_setup_marker (id integer)");
});
afterEach(async () => {
  await DB.getInstance().getPool().query("DROP TABLE generated_setup_marker");
});
const rows = async () =>
  (
    await DB.getInstance()
      .getPool()
      .query("SELECT * FROM generated_setup_marker")
  ).rows;

test.each([
  "save",
  "saveX",
  "changeset",
  "changesetWithOptions_BETA",
] as const)("caught generated %s edge setup failure rolls back earlier writes", async (method) => {
  let caught: unknown;
  await expect(
    withTransaction(async (tx) => {
      await tx.exec("INSERT INTO generated_setup_marker VALUES (1)");
      try {
        await action()[method]();
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toContain("error loading edge data");
    }),
  ).rejects.toThrow("error loading edge data");
  expect(await rows()).toEqual([]);
});

test.each([
  "valid",
  "validX",
] as const)("generated %s setup failure keeps standalone validation recoverable", async (method) => {
  await withTransaction(async (tx) => {
    await tx.exec("INSERT INTO generated_setup_marker VALUES (1)");
    await expect(action()[method]()).rejects.toThrow("error loading edge data");
  });
  expect(await rows()).toEqual([{ id: 1 }]);
});

test.each([
  "save",
  "saveX",
] as const)("unscoped %s failure preserves earlier committed work", async (method) => {
  await DB.getInstance()
    .getPool()
    .exec("INSERT INTO generated_setup_marker VALUES (1)");
  await expect(action()[method]()).rejects.toThrow("error loading edge data");
  expect(await rows()).toEqual([{ id: 1 }]);
});
