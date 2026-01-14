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
      key: 1,
    });
    expect(onDataLoaderCacheHit).toHaveBeenCalledWith({
      tableName: "users",
      key: 2,
    });
    expect(onQueryCacheHit).toHaveBeenCalledTimes(2);
  });
});
