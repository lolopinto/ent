import { Viewer, Data, Loader, LoaderWithLoadMany, QueryOptions } from "./base";
import { IncomingMessage, ServerResponse } from "http";

import { log } from "./logger";
import { Context } from "./base";
import { getJoinInfo, getOrderByPhrase } from "./query_impl";

// RequestBasedContext e.g. from an HTTP request with a server/response conponent
export interface RequestContext<TViewer extends Viewer = Viewer>
  extends Context<TViewer> {
  authViewer(viewer: TViewer): Promise<void>; //logs user in and changes viewer to this
  logout(): Promise<void>;
  request: IncomingMessage;
  response: ServerResponse;
}

export class ContextCache {
  loaders: Map<string, Loader<any, any>> = new Map();
  // we should eventually combine the two but better for typing to be separate for now
  loaderWithLoadMany: Map<string, LoaderWithLoadMany<any, any>> = new Map();

  // keep track of discarded loaders in case someone ends up holding onto a reference
  // so that we can call clearAll() on them
  discardedLoaders: Loader<any, any>[] = [];

  getLoader<K, V>(name: string, create: () => Loader<K, V>): Loader<K, V> {
    let l = this.loaders.get(name);
    if (l) {
      return l;
    }
    log("debug", `new context-aware loader created for ${name}`);
    l = create();
    this.loaders.set(name, l);
    return l;
  }

  getLoaderWithLoadMany<K, V>(
    name: string,
    create: () => LoaderWithLoadMany<K, V>,
  ): LoaderWithLoadMany<K, V> {
    let l = this.loaderWithLoadMany.get(name);
    if (l) {
      return l;
    }
    log("debug", `new context-aware loader created for ${name}`);
    l = create();
    this.loaderWithLoadMany.set(name, l);
    return l;
  }

  // we have a per-table map to make it easier to purge and have less things to compare with
  private itemMap: Map<string, Map<string, Data>> = new Map();
  private listMap: Map<string, Map<string, Data[]>> = new Map();

  // tableName is ignored bcos already indexed on that
  // maybe we just want to store sql queries???

  private getkey(options: QueryOptions): string {
    let parts: string[] = [
      options.fields.join(","),
      options.clause.instanceKey(),
    ];
    if (options.orderby) {
      parts.push(getOrderByPhrase(options.orderby));
    }
    if (options.join) {
      parts.push(getJoinInfo(options.join).phrase);
    }
    return parts.join(",");
  }

  getCachedRows(options: QueryOptions): Data[] | null {
    let m = this.listMap.get(options.tableName);
    if (!m) {
      return null;
    }
    const key = this.getkey(options);
    let rows = m.get(key);
    if (rows) {
      log("cache", {
        "cache-hit": key,
        "tableName": options.tableName,
      });
    }
    return rows || null;
  }

  getCachedRow(options: QueryOptions): Data | null {
    let m = this.itemMap.get(options.tableName);
    if (!m) {
      return null;
    }
    const key = this.getkey(options);
    let row = m.get(key);
    if (row) {
      log("cache", {
        "cache-hit": key,
        "tableName": options.tableName,
      });
    }
    return row || null;
  }

  primeCache(options: QueryOptions, rows: Data[]): void;
  primeCache(options: QueryOptions, rows: Data): void;
  primeCache(options: QueryOptions, rows: Data[] | Data): void {
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
    this.discardedLoaders.forEach((l) => l.clearAll());

    for (const [_key, loader] of this.loaders) {
      loader.clearAll();
      this.discardedLoaders.push(loader);
    }
    for (const [_key, loader] of this.loaderWithLoadMany) {
      loader.clearAll();
      this.discardedLoaders.push(loader);
    }
    this.loaders.clear();
    this.loaderWithLoadMany.clear();
    this.itemMap.clear();
    this.listMap.clear();
  }

  /**
   * reset clears the cache and resets the discarded loaders
   * this is used in long-running things like tests or websocket connections where the same Context or ContextCache is being used repeatedly
   */
  reset(): void {
    this.clearCache();
    this.discardedLoaders = [];
  }
}
