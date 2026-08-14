import { afterAll, beforeAll, beforeEach } from "bun:test";
import { FakeComms } from "@snowtop/ent/testutils/fake_comms";
import { FakeLogger } from "@snowtop/ent/testutils/fake_log";
import { ensureBunTestDB, teardownBunTestDB } from "./db_setup.js";

const nativeDate = Date;

beforeAll(async () => {
  await ensureBunTestDB();
});

beforeEach(() => {
  // Some legacy test helpers install jest-date-mock while modules are loaded.
  // Keep Bun's timeout clock native; tests use explicit timestamps instead.
  globalThis.Date = nativeDate;
  FakeLogger.clear();
  FakeComms.clear();
});

afterAll(async () => {
  await teardownBunTestDB();
});
