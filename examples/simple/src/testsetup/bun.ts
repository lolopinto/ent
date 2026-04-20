import { afterAll, beforeEach } from "bun:test";
import { FakeComms } from "@snowtop/ent/testutils/fake_comms";
import { FakeLogger } from "@snowtop/ent/testutils/fake_log";
import { ensureBunTestDB, teardownBunTestDB } from "./db_setup";

await ensureBunTestDB();

beforeEach(() => {
  FakeLogger.clear();
  FakeComms.clear();
});

afterAll(async () => {
  await teardownBunTestDB();
});
