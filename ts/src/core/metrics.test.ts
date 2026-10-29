import { AssocEdgeLoaderFactory } from "./loaders/assoc_edge_loader";
import { AssocEdge } from "./ent";
import { ObjectLoader, ObjectLoaderFactory } from "./loaders/object_loader";
import * as cacheUtils from "./cache_utils";
import { QueryLoaderFactory } from "./loaders/query_loader";
import { TestContext } from "../testutils/context/test_context";
import { clearLogLevels } from "./logger";
import { InstrumentedDataLoader } from "./loaders/loader";
import { cacheDiagnosticKey } from "./cache_utils";
import { createCountDataLoader } from "./loaders/raw_count_loader";
import { ContextCache } from "./context";
import { DataLoaderBatchMetrics, setMetricsHook } from "./metrics";
import { loadRows } from "./ent";
import * as clause from "./clause";
import type { QueryOptions } from "./base";

jest.mock("./ent", () => ({
  AssocEdge: jest.requireActual("./ent").AssocEdge,
  loadEdgeData: jest.fn(async () => ({ edgeTable: "edges" })),
  loadCustomEdges: jest.fn(async () => []),
  loadRow: jest.fn(),
  loadRows: jest.fn(),
  getDefaultLimit: () => 1000,
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
      loaderId: expect.stringMatching(/^[a-f0-9]{64}$/),
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

describe("batch loader identities", () => {
  beforeEach(() => {
    setMetricsHook();
    clearLogLevels();
    jest.clearAllMocks();
    (loadRows as jest.Mock).mockResolvedValue([]);
  });
  afterEach(() => {
    setMetricsHook();
    jest.restoreAllMocks();
  });

  it.each([
    "query",
    "count",
  ])("distinguishes %s clauses while correlating equivalent configurations", async (kind) => {
    const hook = jest.fn();
    setMetricsHook({ onDataLoaderBatch: hook });
    for (const secret of ["private-a", "private-b", "private-a"]) {
      const options = {
        tableName: "users",
        fields: ["id"],
        clause: clause.Eq("email", clause.sensitiveValue(secret)),
      };
      const context = new TestContext();
      const loader =
        kind === "query"
          ? new QueryLoaderFactory(options).createLoader(context)
          : createCountDataLoader(options, context);
      await loader.load("unused");
    }
    const events = hook.mock.calls.map(([event]) => event);
    expect(events).toHaveLength(3);
    expect(new Set(events.map((e) => e.loaderName)).size).toBe(1);
    for (const event of events) {
      expect(event.loaderId).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(events[0].loaderId).not.toBe(events[1].loaderId);
    expect(events[0].loaderId).toBe(events[2].loaderId);
    expect(JSON.stringify(events)).not.toContain("private-");
  });

  it("distinguishes configured query limits, ordering and transformations", async () => {
    const hook = jest.fn();
    setMetricsHook({ onDataLoaderBatch: hook });
    const factory = new QueryLoaderFactory({
      tableName: "users",
      fields: ["id"],
      groupCol: "account_id",
      clause: clause.Eq("email", clause.sensitiveValue("private-base")),
    });
    const context = new TestContext();
    for (const options of [
      {},
      { limit: 2 },
      { orderby: [{ column: "id", direction: "ASC" as const }] },
      { disableTransformations: true },
    ]) {
      await factory.createConfigurableLoader(options, context).load("account");
    }
    // Equivalent explicit defaults, on a different context/loader object.
    await factory
      .createConfigurableLoader(
        {
          limit: 1000,
          orderby: [{ column: "created_at", direction: "DESC" }],
          disableTransformations: false,
        },
        new TestContext(),
      )
      .load("account");
    const events = hook.mock.calls.map(([event]) => event);
    expect(events).toHaveLength(5);
    expect(new Set(events.slice(0, 4).map((e) => e.loaderId)).size).toBe(4);
    expect(events[0].loaderId).toBe(events[4].loaderId);
    expect(JSON.stringify(events)).not.toContain("private-base");
  });

  it.each([
    "id",
    "clause",
    "count",
  ])("keeps object %s loader configurations distinct", async (kind) => {
    const hook = jest.fn();
    setMetricsHook({ onDataLoaderBatch: hook });
    for (const secret of [
      "object-secret-a",
      "object-secret-b",
      "object-secret-a",
    ]) {
      const factory = new ObjectLoaderFactory({
        tableName: "users",
        fields: ["id"],
        key: "id",
        clause: clause.Eq("email", clause.sensitiveValue(secret)),
      });
      const context = new TestContext();
      if (kind === "count") {
        await factory
          .createCountLoader(context)
          .load(clause.Eq("id", "unused"));
      } else if (kind === "clause") {
        await factory.createLoader(context).load(clause.Eq("id", "unused"));
      } else {
        await factory.createLoader(context).load("unused");
      }
    }
    const events = hook.mock.calls.map(([event]) => event);
    expect(events).toHaveLength(3);
    expect(events[0].loaderId).not.toBe(events[1].loaderId);
    expect(events[0].loaderId).toBe(events[2].loaderId);
    expect(JSON.stringify(events)).not.toContain("object-secret");
  });

  it("does not evaluate dynamic object clauses to identify a loader", async () => {
    const dynamicClause = jest.fn(() => clause.Eq("active", true));
    const factory = new ObjectLoaderFactory({
      tableName: "users",
      fields: ["id"],
      key: "id",
      clause: dynamicClause,
      instanceKey: "dynamic-secret",
    });
    const hook = jest.fn();
    setMetricsHook({ onDataLoaderBatch: hook });
    await factory.createLoader(new TestContext()).load("unused");
    // The query calls the clause once; diagnostics must not invoke it again.
    expect(dynamicClause).toHaveBeenCalledTimes(1);
    expect(hook.mock.calls[0][0].loaderId).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(hook.mock.calls)).not.toContain("dynamic-secret");
  });

  it("distinguishes association loader configurations and normalizes defaults", async () => {
    const hook = jest.fn();
    setMetricsHook({ onDataLoaderBatch: hook });
    const factory = new AssocEdgeLoaderFactory("edge-type", AssocEdge);
    for (const options of [
      {},
      { limit: 2 },
      { orderby: [{ column: "time", direction: "ASC" as const }] },
      { disableTransformations: true },
      { clause: clause.Eq("data", clause.sensitiveValue("edge-secret-a")) },
      { clause: clause.Eq("data", clause.sensitiveValue("edge-secret-b")) },
      {
        limit: 1000,
        orderby: [{ column: "time", direction: "DESC" as const }],
        disableTransformations: false,
      },
    ]) {
      await factory
        .createConfigurableLoader(options, new TestContext())
        .load("unused");
    }
    const events = hook.mock.calls.map(([event]) => event);
    expect(events).toHaveLength(7);
    expect(new Set(events.slice(0, 6).map((e) => e.loaderId)).size).toBe(6);
    expect(events[0].loaderId).toBe(events[6].loaderId);
    expect(JSON.stringify(events)).not.toContain("edge-secret");
  });

  it("computes an ID only on the first observed batch and reuses it after hook changes", async () => {
    const digest = jest.spyOn(cacheUtils, "cacheDiagnosticKey");
    const identity = jest.fn(() => "private-loader-identity");
    const loader = new InstrumentedDataLoader<number, number>(
      "example",
      async (keys) => keys.map((key) => key),
      { cache: false },
      { identity },
    );
    await loader.load(1);
    expect(digest).not.toHaveBeenCalled();
    expect(identity).not.toHaveBeenCalled();
    const hook = jest.fn();
    setMetricsHook({ onDataLoaderBatch: hook });
    await loader.load(2);
    await loader.load(3);
    expect(digest).toHaveBeenCalledTimes(1);
    setMetricsHook();
    await loader.load(4);
    setMetricsHook({ onDataLoaderBatch: hook });
    await loader.load(5);
    expect(digest).toHaveBeenCalledTimes(1);
    const events = hook.mock.calls.map(([event]) => event);
    expect(events).toHaveLength(3);
    expect(identity).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(events)).not.toContain("private-loader-identity");
    expect(events[0].loaderId).toMatch(/^[a-f0-9]{64}$/);
    expect(new Set(events.map((e) => e.loaderId)).size).toBe(1);
  });
});

test("batch metrics remain compatible with producers that supply only legacy fields", () => {
  const legacy: DataLoaderBatchMetrics = { loaderName: "old", batchSize: 1 };
  expect(legacy.loaderId).toBeUndefined();
});

test("direct dynamic loaders omit unknown logical identity and accept explicit stable keys", async () => {
  const hook = jest.fn();
  setMetricsHook({ onDataLoaderBatch: hook });
  (loadRows as jest.Mock).mockResolvedValue([]);
  try {
    for (const instanceKey of [
      undefined,
      undefined,
      "config-a",
      "config-b",
      "config-a",
    ]) {
      const dynamicClause = jest.fn(() => clause.Eq("active", true));
      const loader = new ObjectLoader(
        {
          tableName: "users",
          fields: ["id"],
          key: "id",
          clause: dynamicClause,
          instanceKey,
        },
        new TestContext(),
      );
      await loader.load("unused");
      expect(dynamicClause).toHaveBeenCalledTimes(1);
    }
    const events = hook.mock.calls.map(([event]) => event);
    expect(events[0]).not.toHaveProperty("loaderId");
    expect(events[1]).not.toHaveProperty("loaderId");
    expect(events[2].loaderId).toMatch(/^[a-f0-9]{64}$/);
    expect(events[2].loaderId).not.toBe(events[3].loaderId);
    expect(events[2].loaderId).toBe(events[4].loaderId);
  } finally {
    setMetricsHook();
  }
});

test("object diagnostic identities use stable distinct counters without evaluating objects", () => {
  const first = {
    toJSON: () => {
      throw new Error("do not serialize");
    },
  };
  const second = {};
  expect(cacheDiagnosticKey(first)).toMatch(/^ref:[0-9]+$/);
  expect(cacheDiagnosticKey(first)).toBe(cacheDiagnosticKey(first));
  expect(cacheDiagnosticKey(first)).not.toBe(cacheDiagnosticKey(second));
  expect(cacheDiagnosticKey("ref:1")).toMatch(/^[a-f0-9]{64}$/);
});

test.each([
  "legacy",
  "options",
])("%s metrics arguments preserve cache-key normalization", async (form) => {
  const hook = jest.fn();
  setMetricsHook({ onDataLoaderCacheHit: hook });
  const normalize = (key: string) => `normalized:${key}`;
  try {
    const batch = async (keys: readonly string[]) => keys.map(() => 1);
    const options = { cacheMap: new Map<string, Promise<number>>() };
    const loader =
      form === "legacy"
        ? new InstrumentedDataLoader(
            "custom",
            batch,
            options,
            "users",
            normalize,
          )
        : new InstrumentedDataLoader("custom", batch, options, {
            tableName: "users",
            cacheKeyFn: normalize,
          });
    await loader.load("private-key");
    await loader.load("private-key");
    expect(hook).toHaveBeenCalledWith({
      tableName: "users",
      key: cacheDiagnosticKey("normalized:private-key"),
    });
    expect(JSON.stringify(hook.mock.calls)).not.toContain("private-key");
  } finally {
    setMetricsHook();
  }
});

test("distinct local symbol keys stay distinct while registry symbols correlate", async () => {
  const keys = [
    Symbol("private-description"),
    Symbol("private-description"),
    Symbol.for("private-description"),
  ];
  const hook = jest.fn();
  setMetricsHook({ onDataLoaderCacheHit: hook });
  try {
    const loader = new InstrumentedDataLoader<symbol, number>(
      "symbols",
      async (values) => values.map(() => 0),
      { cacheMap: new Map() },
      "users",
    );
    for (const [index, key] of keys.entries()) {
      loader.prime(key, index);
      expect(await loader.load(key)).toBe(index);
      expect(await loader.load(key)).toBe(index);
    }
    const identities = hook.mock.calls.map(([event]) => event.key);
    expect(new Set(identities).size).toBe(3);
    expect(identities[0]).toBe(identities[1]);
    expect(identities[2]).toBe(identities[3]);
    expect(identities[4]).toBe(
      cacheDiagnosticKey(Symbol.for("private-description")),
    );
    expect(JSON.stringify(hook.mock.calls)).not.toContain(
      "private-description",
    );
  } finally {
    setMetricsHook();
  }
});
