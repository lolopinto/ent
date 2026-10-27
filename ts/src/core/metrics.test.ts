import { cacheDiagnosticKey } from "./cache_utils";
import { createCountDataLoader } from "./loaders/raw_count_loader";
import { ContextCache } from "./context";
import { setMetricsHook } from "./metrics";
import { loadRows } from "./ent";
import * as clause from "./clause";
import type { QueryOptions } from "./base";

jest.mock("./ent", () => ({
  loadRow: jest.fn(),
  loadRows: jest.fn(),
}));

describe("metrics hooks", () => {
  beforeEach(() => {
    setMetricsHook();
    jest.clearAllMocks();
  });

  afterEach(() => {
    setMetricsHook();
  });

  it("fires hooks for loader batches and cache hits", async () => {
    const onDataLoaderBatch = jest.fn();
    const onDataLoaderCacheHit = jest.fn();
    const onQueryCacheHit = jest.fn();

    setMetricsHook({
      onDataLoaderBatch,
      onDataLoaderCacheHit,
      onQueryCacheHit,
    });

    const loadRowsMock = loadRows as jest.MockedFunction<typeof loadRows>;
    loadRowsMock.mockResolvedValue([
      { id: 1, count: "2" },
      { id: 2, count: "3" },
    ]);

    const loader = createCountDataLoader({
      tableName: "users",
      groupCol: "id",
    });
    await loader.loadMany([1, 2]);
    await loader.loadMany([1, 2]);

    const contextCache = new ContextCache();
    const queryOptions: QueryOptions = {
      tableName: "users",
      fields: ["id"],
      clause: clause.Eq("id", 1),
    };
    contextCache.primeCache(queryOptions, { id: 1 });
    contextCache.getCachedRow(queryOptions);
    contextCache.primeCache(queryOptions, [{ id: 1 }]);
    contextCache.getCachedRows(queryOptions);

    expect(onDataLoaderBatch).toHaveBeenCalledWith({
      loaderName: "rawCountLoader:users:id",
      batchSize: 2,
    });
    expect(onDataLoaderCacheHit).toHaveBeenCalledWith({
      tableName: "users",
      key: cacheDiagnosticKey(1),
    });
    expect(onDataLoaderCacheHit).toHaveBeenCalledWith({
      tableName: "users",
      key: cacheDiagnosticKey(2),
    });
    expect(onQueryCacheHit).toHaveBeenCalledTimes(2);
  });
});

it("metrics preserve cached bigint and cyclic-object loader keys", async () => {
  const { InstrumentedDataLoader } = await import("./loaders/loader");
  const circular: { self?: unknown } = {};
  circular.self = circular;
  const keys = [BigInt(1), circular];
  const hits: unknown[] = [];
  setMetricsHook({ onDataLoaderCacheHit: (info) => hits.push(info.key) });
  try {
    const loader = new InstrumentedDataLoader<unknown, number>(
      "generic",
      async (keys) => keys.map(() => 5),
      { cacheMap: new Map() },
      "events",
    );
    for (const key of keys) {
      loader.prime(key, 5);
      expect(await loader.load(key)).toBe(5);
      expect(await loader.load(key)).toBe(5);
    }
    expect(hits).toHaveLength(4);
    expect(hits[0]).toBe(hits[1]);
    expect(hits[2]).toBe(hits[3]);
    expect(hits[0]).not.toBe(hits[2]);
    for (const hit of hits) {
      expect(typeof hit).toBe("string");
    }
  } finally {
    setMetricsHook();
  }
});
