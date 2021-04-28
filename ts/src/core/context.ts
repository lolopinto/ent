import {
  Viewer,
  ID,
  Data,
  DataOptions,
  SelectDataOptions,
  Loader,
} from "./base";
import { IncomingMessage, ServerResponse } from "http";

import DataLoader from "dataloader";
import * as clause from "./clause";
import { log, logEnabled } from "./logger";
import { Context, LoadRowOptions } from "./base";
import { loadRows } from "./ent";

// export interface Context {
//   getViewer(): Viewer;
//   // optional per (request)contet
//   // absence means we are not doing any caching
//   // presence means we have loader, ent cache etc
//   cache?: ContextCache;
// }

// TODO kill and createDataLoader
class cacheMap {
  private m = new Map();
  constructor(private options: DataOptions) {}
  get(key) {
    const ret = this.m.get(key);
    if (ret) {
      log("query", {
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

function createDataLoader(options: SelectDataOptions) {
  const loaderOptions: DataLoader.Options<any, any> = {};

  // if query logging is enabled, we should log what's happening with loader
  if (logEnabled("query")) {
    loaderOptions.cacheMap = new cacheMap(options);
  }

  return new DataLoader(async (ids: ID[]) => {
    if (!ids.length) {
      return [];
    }
    let col = options.pkey || "id";
    const rowOptions: LoadRowOptions = {
      ...options,
      clause: clause.In(col, ...ids),
    };

    // TODO is there a better way of doing this?
    // context not needed because we're creating a loader which has its own cache which is being used here
    const nodes = await loadRows(rowOptions);
    let result: (Data | null)[] = ids.map((id) => {
      for (const node of nodes) {
        if (node[col] === id) {
          return node;
        }
      }
      return null;
    });

    return result;
  }, loaderOptions);
}

// RequestBasedContext e.g. from an HTTP request with a server/response conponent
export interface RequestContext extends Context {
  authViewer(viewer: Viewer): Promise<void>; //logs user in and changes viewer to this
  logout(): Promise<void>;
  request: IncomingMessage;
  response: ServerResponse;
}

export class ContextCache {
  loaders: Map<string, DataLoader<ID, Data | null>> = new Map();

  realLoaders: Map<string, Loader<any, any>> = new Map();

  // only create as needed for the "requests" which need it
  // TODO delete
  getEntLoader(loaderOptions: SelectDataOptions): DataLoader<ID, Data | null> {
    let l = this.loaders.get(loaderOptions.tableName);

    if (l) {
      return l;
    }
    let l2 = createDataLoader(loaderOptions);
    this.loaders.set(loaderOptions.tableName, l2);
    return l2;
  }

  getRealLoader<T, V>(name: string, create: () => Loader<T, V>): Loader<T, V> {
    let l = this.realLoaders.get(name);
    if (l) {
      return l;
    }
    log("debug", `new context-aware loader created for ${name}`);
    l = create();
    this.realLoaders.set(name, l);
    return l;
  }

  // we have a per-table map to make it easier to purge and have less things to compare with
  private itemMap: Map<string, Map<string, Data>> = new Map();
  private listMap: Map<string, Map<string, Data[]>> = new Map();

  // tableName is ignored bcos already indexed on that
  // maybe we just want to store sql queries???

  private getkey(options: queryOptions): string {
    let parts: string[] = [
      options.fields.join(","),
      options.clause.instanceKey(),
    ];
    if (options.orderby) {
      parts.push(options.orderby);
    }
    return parts.join(",");
  }

  getCachedRows(options: queryOptions): Data[] | null {
    let m = this.listMap.get(options.tableName);
    if (!m) {
      return null;
    }
    const key = this.getkey(options);
    let rows = m.get(key);
    if (rows) {
      log("query", {
        "cache-hit": key,
        "tableName": options.tableName,
      });
    }
    return rows || null;
  }

  getCachedRow(options: queryOptions): Data | null {
    let m = this.itemMap.get(options.tableName);
    if (!m) {
      return null;
    }
    const key = this.getkey(options);
    let row = m.get(key);
    if (row) {
      log("query", {
        "cache-hit": key,
        "tableName": options.tableName,
      });
    }
    return row || null;
  }

  primeCache(options: queryOptions, rows: Data[]): void;
  primeCache(options: queryOptions, rows: Data): void;
  primeCache(options: queryOptions, rows: Data[] | Data): void {
    if (Array.isArray(rows)) {
      let m = this.listMap.get(options.tableName) || new Map();
      m.set(this.getkey(options), rows);
      this.listMap.set(options.tableName, m);
    } else {
      let m = this.itemMap.get(options.tableName) || new Map();
      m.set(this.getkey(options), rows);
      this.itemMap.set(options.tableName, m);
    }
  }

  clearCache(): void {
    for (const [_key, loader] of this.loaders) {
      loader.clearAll();
    }
    this.loaders.clear();
    this.itemMap.clear();
    this.listMap.clear();
  }
}

interface queryOptions {
  fields: string[];
  tableName: string;
  clause: clause.Clause;
  orderby?: string;
}
