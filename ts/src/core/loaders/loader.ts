import { Loader, LoaderFactory, Context, DataOptions } from "../base";
import { log } from "../logger";

// this is like factory factory FML
// helper function to handle context vs not
// and to keep the API clean for clients who shouldn't have to worry about this
export function getLoader<T, V>(
  factory: LoaderFactory<T, V>,
  create: () => Loader<T, V>,
  context?: Context,
): Loader<T, V> {
  // just create a new one every time if no context cache
  if (!context?.cache) {
    log("debug", `new loader created for ${factory.name}`);
    return create();
  }

  // g|set from context cache
  return context.cache.getLoader(factory.name, create);
}

export function getCustomLoader<T, V>(
  key: string,
  create: () => Loader<T, V>,
  context?: Context,
): Loader<T, V> {
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
      log("query", {
        "dataloader-cache-hit": key,
        "tableName": this.options.tableName,
      });
      // } else {
      //   log("query", {
      //     "dataloader-cache-miss": key,
      //     "tableName": options.tableName,
      //   });
    }
    return ret;
  }

  set(key, value) {
    // log("query", {
    //   "dataloader-cache-set": key,
    //   "tableName": options.tableName,
    // });
    return this.m.set(key, value);
  }

  delete(key) {
    // log("query", {
    //   "dataloader-cache-delete": key,
    //   "tableName": options.tableName,
    // });
    return this.m.delete(key);
  }

  clear() {
    // log("query", {
    //   "dataloader-cache-clear": true,
    //   "tableName": options.tableName,
    // });
    return this.m.clear();
  }
}
