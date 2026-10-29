import { cacheDiagnosticKey, stableStringify } from "../cache_utils";
import DataLoader from "dataloader";
import { Loader, LoaderFactory, Context, DataOptions } from "../base";
import { logIf, logEnabled } from "../logger";
import { getOnDataLoaderBatch, getOnDataLoaderCacheHit } from "../metrics";

const DEFAULT_MAX_BATCH_SIZE = 1000;
let loaderMaxBatchSize = DEFAULT_MAX_BATCH_SIZE;

const DEFAULT_MAX_CACHE_ENTRIES = 1000;
let loaderCacheMaxEntries = DEFAULT_MAX_CACHE_ENTRIES;

export function getLoaderMaxBatchSize(): number {
  return loaderMaxBatchSize;
}

export function setLoaderMaxBatchSize(size?: number | null) {
  if (size === undefined || size === null) {
    loaderMaxBatchSize = DEFAULT_MAX_BATCH_SIZE;
    return;
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error(`maxBatchSize must be a positive number`);
  }
  loaderMaxBatchSize = Math.floor(size);
}

export function getLoaderCacheMaxEntries(): number {
  return loaderCacheMaxEntries;
}

export function setLoaderCacheMaxEntries(size?: number | null) {
  if (size === undefined || size === null) {
    loaderCacheMaxEntries = DEFAULT_MAX_CACHE_ENTRIES;
    return;
  }
  if (!Number.isFinite(size) || size < 0) {
    throw new Error(`maxCacheEntries must be a non-negative number`);
  }
  loaderCacheMaxEntries = Math.floor(size);
}

// this is like factory factory FML
// helper function to handle context vs not
// and to keep the API clean for clients who shouldn't have to worry about this
export function getLoader<K, V>(
  factory: LoaderFactory<K, V>,
  create: () => Loader<K, V>,
  context?: Context,
): Loader<K, V> {
  // just create a new one every time if no context cache
  if (!context?.cache) {
    logIf(
      "debug",
      () => `new loader created for ${cacheDiagnosticKey(factory.name)}`,
    );
    return create();
  }

  // g|set from context cache
  return context.cache.getLoader(factory.name, create);
}

export function getCustomLoader<K, V>(
  key: string,
  create: () => Loader<K, V>,
  context?: Context,
): Loader<K, V> {
  // just create a new one every time if no context cache
  if (!context?.cache) {
    logIf("debug", () => `new loader created for ${cacheDiagnosticKey(key)}`);
    return create();
  }

  // g|set from context cache
  return context.cache.getLoader(key, create);
}

export type CacheMapLike<K, V> = {
  get(key: K): V | undefined;
  set(key: K, value: V): any;
  delete(key: K): any;
  clear(): any;
};

type CacheKeyFn<K> = (key: K) => any;

type BatchLoadFn<K, V> = (
  keys: readonly K[],
) => PromiseLike<ArrayLike<V | Error>>;

function instrumentCacheMap<K, V>(
  cacheMap: CacheMapLike<K, V> | null | undefined,
  tableName?: string,
  cacheKeyFn?: (key: K) => unknown,
): CacheMapLike<K, V> | null | undefined {
  if (!cacheMap || !tableName) {
    return cacheMap;
  }

  return {
    get(key: K) {
      const value = cacheMap.get(key);
      if (value !== undefined) {
        const hook = getOnDataLoaderCacheHit();
        if (hook) {
          hook({
            tableName,
            key: cacheDiagnosticKey(cacheKeyFn ? cacheKeyFn(key) : key),
          });
        }
      }
      return value;
    },
    set(key: K, value: V) {
      return cacheMap.set(key, value);
    },
    delete(key: K) {
      return cacheMap.delete(key);
    },
    clear() {
      return cacheMap.clear();
    },
  };
}

export type LoaderIdentity =
  | string
  | Record<string, string | number | boolean | null | undefined>;

export type LoaderMetricsOptions<K> = {
  tableName?: string;
  cacheKeyFn?: (key: K) => unknown;
  // Full logical configuration, never emitted directly. Returning undefined
  // omits loaderId when no stable logical identity is available.
  identity?: () => LoaderIdentity | undefined;
};

// Encode and hash the configuration supplied by each loader. The constructor
// below computes this lazily and memoizes the result per loader instance.
function batchIdentity(
  loaderName: string,
  options: LoaderMetricsOptions<unknown>,
) {
  const configuration = options.identity ? options.identity() : loaderName;
  return configuration === undefined
    ? {}
    : {
        loaderId: cacheDiagnosticKey(
          stableStringify({ loaderName, configuration }),
        ),
      };
}

export class InstrumentedDataLoader<K, V> extends DataLoader<K, V> {
  constructor(
    // Callers must supply a stable label without query values or other sensitive
    // data: it is emitted without redaction.
    loaderName: string,
    batchLoadFn: BatchLoadFn<K, V>,
    options: DataLoader.Options<K, V>,
    metricsOrTableName?: LoaderMetricsOptions<K> | string,
    // Legacy positional argument, used only when metricsOrTableName is a string
    // or undefined. With an options object, set its cacheKeyFn instead; this
    // positional argument is ignored.
    cacheKeyFn?: (key: K) => unknown,
  ) {
    const metrics =
      typeof metricsOrTableName === "string" || metricsOrTableName === undefined
        ? { tableName: metricsOrTableName, cacheKeyFn }
        : metricsOrTableName;
    let identity: { loaderId?: string } | undefined;
    const wrappedBatchFn: BatchLoadFn<K, V> = async (keys) => {
      if (keys.length) {
        const hook = getOnDataLoaderBatch();
        if (hook) {
          identity ??= batchIdentity(loaderName, metrics);
          hook({ loaderName, ...identity, batchSize: keys.length });
        }
      }
      return batchLoadFn(keys);
    };
    const cacheMap = instrumentCacheMap(
      options.cacheMap,
      metrics.tableName,
      metrics.cacheKeyFn,
    );
    const loaderOptions =
      cacheMap === options.cacheMap ? options : { ...options, cacheMap };
    super(wrappedBatchFn, loaderOptions);
  }
}

export class BoundedCacheMap<K, V> {
  private order = new Map<any, K>();

  constructor(
    private cacheMap: CacheMapLike<K, V>,
    private maxEntries: number,
    private cacheKeyFn?: CacheKeyFn<K>,
  ) {}

  private normalizeKey(key: K) {
    return this.cacheKeyFn ? this.cacheKeyFn(key) : key;
  }

  private touch(normalizedKey: any, key: K) {
    if (this.order.has(normalizedKey)) {
      this.order.delete(normalizedKey);
    }
    this.order.set(normalizedKey, key);
  }

  private evictIfNeeded() {
    while (this.order.size > this.maxEntries) {
      const oldest = this.order.entries().next().value;
      if (!oldest) {
        return;
      }
      const [normalizedKey, key] = oldest;
      this.order.delete(normalizedKey);
      this.cacheMap.delete(key);
    }
  }

  get(key: K): V | undefined {
    const value = this.cacheMap.get(key);
    if (value !== undefined) {
      const normalizedKey = this.normalizeKey(key);
      this.touch(normalizedKey, key);
    }
    return value;
  }

  set(key: K, value: V) {
    const normalizedKey = this.normalizeKey(key);
    this.touch(normalizedKey, key);
    const result = this.cacheMap.set(key, value);
    this.evictIfNeeded();
    return result;
  }

  delete(key: K) {
    const normalizedKey = this.normalizeKey(key);
    this.order.delete(normalizedKey);
    return this.cacheMap.delete(key);
  }

  clear() {
    this.order.clear();
    return this.cacheMap.clear();
  }
}

export function createBoundedCacheMap<K, V>(
  cacheMap: CacheMapLike<K, V>,
  cacheKeyFn?: CacheKeyFn<K>,
): CacheMapLike<K, V> {
  const maxEntries = getLoaderCacheMaxEntries();
  if (maxEntries <= 0) {
    return cacheMap;
  }
  return new BoundedCacheMap(cacheMap, maxEntries, cacheKeyFn);
}

export function createLoaderCacheMap<K, V>(
  options: DataOptions,
): CacheMapLike<K, V> {
  const baseMap: CacheMapLike<K, V> = logEnabled("query")
    ? new CacheMap<K, V>(options)
    : new Map<K, V>();
  return createBoundedCacheMap(baseMap);
}

export class CacheMap<K, V> implements CacheMapLike<K, V> {
  private m = new Map<K, V>();
  constructor(private options: DataOptions) {}
  get(key: K) {
    const ret = this.m.get(key);
    if (ret) {
      // Keep cache keys opaque: raw keys can contain sensitive lookup values.
      logIf("cache", () => ({
        "dataloader-cache-hit": cacheDiagnosticKey(key),
        tableName: this.options.tableName,
      }));
    }
    return ret;
  }

  set(key: K, value: V) {
    return this.m.set(key, value);
  }

  delete(key: K) {
    return this.m.delete(key);
  }

  clear() {
    return this.m.clear();
  }
}
