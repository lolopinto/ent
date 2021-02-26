import {
  Viewer,
  ID,
  Data,
  SelectDataOptions,
  createDataLoader,
} from "../core/ent";
import { IncomingMessage, ServerResponse } from "http";

import DataLoader from "dataloader";
import * as clause from "./clause";

export interface Context {
  getViewer(): Viewer;
  // optional per (request)contet
  // absence means we are not doing any caching
  // presence means we have loader, ent cache etc
  cache?: ContextCache;
}

// RequestBasedContet e.g. from an HTTP request with a server/response conponent
export interface RequestContext extends Context {
  authViewer(viewer: Viewer): Promise<void>; //logs user in and changes viewer to this
  logout(): Promise<void>;
  request: IncomingMessage;
  response: ServerResponse;
}

export class ContextCache {
  loaders: Map<string, DataLoader<ID, Data | null>> = new Map();

  // only create as needed for the "requests" which need it
  getEntLoader(loaderOptions: SelectDataOptions) {
    let l = this.loaders.get(loaderOptions.tableName);

    if (l) {
      return l;
    }
    l = createDataLoader(loaderOptions);
    this.loaders.set(loaderOptions.tableName, l);
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
    let rows = m.get(this.getkey(options));
    return rows || null;
  }

  getCachedRow(options: queryOptions): Data | null {
    let m = this.itemMap.get(options.tableName);
    if (!m) {
      return null;
    }
    let row = m.get(this.getkey(options));
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
