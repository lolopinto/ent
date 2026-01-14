import { Loader, LoaderFactory, Context, DataOptions } from "../base";
import { log, logEnabled } from "../logger";

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
    log("debug", `new loader created for ${factory.name}`);
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
    log("debug", `new loader created for ${key}`);
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
    ? new CacheMap(options)
    : new Map();
  return createBoundedCacheMap(baseMap);
}

export class CacheMap {
  private m = new Map();
  constructor(private options: DataOptions) {}
  get(key) {
    const ret = this.m.get(key);
    if (ret) {
      // should this be debug?
      // might be a lot?
      // TODO this is not the best log format
      // was designed for ObjectLoader time. Now we have different needs e.g. count, assoc etc
      log("cache", {
        "dataloader-cache-hit": key,
        "tableName": this.options.tableName,
      });
    }
    return ret;
  }

  set(key, value) {
    return this.m.set(key, value);
  }

  delete(key) {
    return this.m.delete(key);
  }

  clear() {
    return this.m.clear();
  }
}
