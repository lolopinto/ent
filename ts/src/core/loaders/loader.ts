import { Loader, LoaderFactory, Context, DataOptions } from "../base";
import { log } from "../logger";

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

export class cacheMap {
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
      // } else {
      //   log("cache", {
      //     "dataloader-cache-miss": key,
      //     "tableName": options.tableName,
      //   });
    }
    return ret;
  }

  set(key, value) {
    // log("cache", {
    //   "dataloader-cache-set": key,
    //   "tableName": options.tableName,
    // });
    return this.m.set(key, value);
  }

  delete(key) {
    // log("cache", {
    //   "dataloader-cache-delete": key,
    //   "tableName": options.tableName,
    // });
    return this.m.delete(key);
  }

  clear() {
    // log("cache", {
    //   "dataloader-cache-clear": true,
    //   "tableName": options.tableName,
    // });
    return this.m.clear();
  }
}
