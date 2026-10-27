import { QueryLoaderFactory } from "./loaders/query_loader";
import { createCountDataLoader } from "./loaders/raw_count_loader";
import { IDViewer } from "./viewer";
import * as cacheUtils from "./cache_utils";
import {
  setupTempDB,
  createTestUser,
} from "../testutils/fake_data/test_helpers";
import { TempDB } from "../testutils/db/temp_db";
import { FakeUser } from "../testutils/fake_data";
import { TestContext } from "../testutils/context/test_context";
import { Eq, sensitiveValue } from "./clause";
import { loadRow, loadRows, loadRowX, loadEntXViaKey, loadEntX } from "./ent";
import { ObjectLoaderFactory } from "./loaders/object_loader";
import { getCustomLoader } from "./loaders/loader";
import { clearLogLevels, setLogLevels } from "./logger";
import { setMetricsHook } from "./metrics";

let db: TempDB;
beforeAll(async () => {
  db = await setupTempDB();
});
afterAll(async () => db.afterAll());

test("sensitive cache identities never reach logs or metrics and stay distinct", async () => {
  const user = await createTestUser();
  const events: unknown[] = [];
  const log = jest
    .spyOn(console, "log")
    .mockImplementation((...args) => events.push(args));
  const debug = jest
    .spyOn(console, "debug")
    .mockImplementation((...args) => events.push(args));
  const trace = jest.spyOn(console, "trace").mockImplementation(() => {});
  setLogLevels(["cache", "debug", "query"]);
  setMetricsHook({
    onQueryCacheHit: (e) => events.push(e),
    onDataLoaderCacheHit: (e) => events.push(e),
    onDataLoaderBatch: (e) => events.push(e),
  });
  const secrets = ["secret-a", "secret-b"];
  try {
    const context = new TestContext(new IDViewer(user.id));
    for (const secret of secrets) {
      const options = {
        ...FakeUser.loaderOptions(),
        context,
        clause: Eq("first_name", sensitiveValue(secret)),
      };
      const row = { id: secret === secrets[0] ? 101 : 102 };
      context.cache.primeCache(options, row);
      context.cache.primeCache(options, [row]);
      expect(await loadRow(options)).toBe(row);
      expect(await loadRows(options)).toEqual([row]);
      const factory = new ObjectLoaderFactory({ ...options, key: "id" });
      const loader = factory.createLoader(context);
      expect(factory.createLoader(context)).toBe(loader);
      await loader.load(Eq("id", user.id));
      await loader.load(Eq("id", user.id));
      const count = factory.createCountLoader(context);
      await count.load(Eq("first_name", sensitiveValue(secret)));
      await count.load(Eq("first_name", sensitiveValue(secret)));
      const plain = new ObjectLoaderFactory({
        ...FakeUser.loaderOptions(),
        key: "id",
      }).createLoader(context);
      await plain.load(Eq("first_name", sensitiveValue(secret)));
      await plain.load(Eq("first_name", sensitiveValue(secret)));
      factory.createLoader();
      factory.createCountLoader();
      getCustomLoader(secret, () => loader);
      context.cache.getLoaderWithLoadMany(secret, () => loader);
    }
    const output = JSON.stringify(events);
    for (const secret of secrets) {
      expect(output).not.toContain(secret);
    }
    expect(events.length).toBeGreaterThan(10);
  } finally {
    setMetricsHook();
    clearLogLevels();
    log.mockRestore();
    debug.mockRestore();
    trace.mockRestore();
  }
});

test("missing-row errors redact sensitive values and retain ordinary diagnostics", async () => {
  await expect(
    loadRowX({
      ...FakeUser.loaderOptions(),
      clause: Eq("first_name", sensitiveValue("never-found-secret")),
    }),
  ).rejects.toThrow("******************");
  await expect(
    loadRowX({
      ...FakeUser.loaderOptions(),
      clause: Eq("first_name", "ordinary-missing-name"),
    }),
  ).rejects.toThrow("ordinary-missing-name");
});

test("missing unique-key errors omit lookup values and factory cache identities", async () => {
  const user = await createTestUser();
  const options = {
    ...FakeUser.loaderOptions(),
    loaderFactory: new ObjectLoaderFactory({
      ...FakeUser.loaderOptions(),
      key: "email_address",
      clause: Eq("first_name", sensitiveValue("factory-secret")),
    }),
  };
  let error: Error | undefined;
  try {
    await loadEntXViaKey(user.viewer, "unique-secret", options);
  } catch (err) {
    error = err as Error;
  }
  expect(error).toBeInstanceOf(Error);
  expect(error!.message).toContain("couldn't find row");
  expect(error!.message).toContain("email_address");
  expect(error!.message).not.toContain("unique-secret");
  expect(error!.message).not.toContain("factory-secret");
});

test("disabled diagnostics do not compute cache digests", async () => {
  const user = await createTestUser();
  const context = new TestContext(new IDViewer(user.id));
  const options = {
    ...FakeUser.loaderOptions(),
    context,
    clause: Eq("id", user.id),
  };
  setLogLevels(["query", "cache"]);
  const factory = new ObjectLoaderFactory({ ...options, key: "id" });
  const loader = factory.createLoader(context);
  await loader.load(user.id);
  await loader.load(Eq("id", user.id));
  await loadEntX(context.getViewer(), user.id, FakeUser.loaderOptions());
  context.cache.primeCache(options, { id: user.id });
  context.cache.primeCache(options, [{ id: user.id }]);
  clearLogLevels();
  setMetricsHook();
  const digest = jest.spyOn(cacheUtils, "cacheDiagnosticKey");
  try {
    await loader.load(user.id);
    await loader.load(Eq("id", user.id));
    await loadEntX(context.getViewer(), user.id, FakeUser.loaderOptions());
    context.cache.getCachedRow(options);
    context.cache.getCachedRows(options);
    factory.createLoader();
    factory.createCountLoader();
    getCustomLoader("disabled-secret", () => loader);
    context.cache.getLoader("disabled-new", () => loader);
    context.cache.getLoaderWithLoadMany("disabled-new-many", () => loader);
    expect(digest).not.toHaveBeenCalled();
  } finally {
    digest.mockRestore();
    clearLogLevels();
  }
});

test("batch labels are stable structural names while clause caches remain distinct", async () => {
  const user = await createTestUser({ firstName: "batch-secret-a" });
  const context = new TestContext(new IDViewer(user.id));
  const names: string[] = [];
  setMetricsHook({
    onDataLoaderBatch: ({ loaderName }) => names.push(loaderName),
  });
  try {
    for (const [secret, expected] of [
      ["batch-secret-a", 1],
      ["batch-secret-b", 0],
    ] as const) {
      const options = {
        ...FakeUser.loaderOptions(),
        clause: Eq("first_name", sensitiveValue(secret)),
      };
      const rows = await new QueryLoaderFactory(options)
        .createLoader(context)
        .load("unused");
      expect(rows).toHaveLength(expected);
      expect(await createCountDataLoader(options, context).load("unused")).toBe(
        expected,
      );
    }
    await loadEntX(context.getViewer(), user.id, {
      ...FakeUser.loaderOptions(),
      loaderFactory: new ObjectLoaderFactory({
        ...FakeUser.loaderOptions(),
        key: "id",
        clause: Eq("first_name", sensitiveValue("batch-secret-a")),
      }),
    });
    expect(
      names.filter((n) => n === "queryLoader:fake_users:clause"),
    ).toHaveLength(2);
    expect(
      names.filter((n) => n === "rawCountLoader:fake_users:clause"),
    ).toHaveLength(2);
    expect(names).toContain("entLoader:fake_users:id");
    expect(JSON.stringify(names)).not.toContain("batch-secret");
  } finally {
    setMetricsHook();
  }
});
