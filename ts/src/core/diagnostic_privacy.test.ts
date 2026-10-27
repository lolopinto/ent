import {
  setupTempDB,
  createTestUser,
} from "../testutils/fake_data/test_helpers";
import { TempDB } from "../testutils/db/temp_db";
import { FakeUser } from "../testutils/fake_data";
import { TestContext } from "../testutils/context/test_context";
import { Eq, sensitiveValue } from "./clause";
import { loadRow, loadRows, loadRowX } from "./ent";
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
    const context = new TestContext();
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
