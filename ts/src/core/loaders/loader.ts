import { Loader, LoaderFactory, Context, DataOptions } from "../base";
import { log } from "../logger";

const DEFAULT_MAX_BATCH_SIZE = 1000;
let loaderMaxBatchSize = DEFAULT_MAX_BATCH_SIZE;

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
