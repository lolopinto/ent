import { Viewer, Data, Loader } from "./base";
import { IncomingMessage, ServerResponse } from "http";

import * as clause from "./clause";
import { log } from "./logger";
import { Context } from "./base";

// RequestBasedContext e.g. from an HTTP request with a server/response conponent
export interface RequestContext extends Context {
  authViewer(viewer: Viewer): Promise<void>; //logs user in and changes viewer to this
  logout(): Promise<void>;
  request: IncomingMessage;
  response: ServerResponse;
}

export class ContextCache {
  loaders: Map<string, Loader<any, any>> = new Map();

  getLoader<T, V>(name: string, create: () => Loader<T, V>): Loader<T, V> {
    let l = this.loaders.get(name);
    if (l) {
      return l;
    }
    log("debug", `new context-aware loader created for ${name}`);
    l = create();
    this.loaders.set(name, l);
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
      // may not need this since we're clearing the loaders themselves...
      // but may have some benefits by explicitily doing so?
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
