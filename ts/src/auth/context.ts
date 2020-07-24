import { getLoggedInViewer } from "./index";
import { Viewer, ID, SelectDataOptions, createDataLoader } from "./../ent";
import { IncomingMessage, ServerResponse } from "http";
import { LoggedOutViewer } from "../viewer";

import DataLoader from "dataloader";
import * as query from "./../query";

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

class contextImpl implements RequestContext {
  cache?: ContextCache;
  private loggedOutViewer: LoggedOutViewer = new LoggedOutViewer();
  private viewer: Viewer;

  constructor(
    public request: IncomingMessage,
    public response: ServerResponse,
  ) {
    this.viewer = this.loggedOutViewer;
  }

  getViewer(): Viewer {
    return this.viewer;
  }

  async authViewer(viewer: Viewer): Promise<void> {
    this.viewer = viewer;
  }

  async logout(): Promise<void> {
    this.viewer = this.loggedOutViewer;
  }
}

export async function buildContext(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<RequestContext> {
  const ctx = new contextImpl(request, response);

  let viewer = await getLoggedInViewer(ctx);
  ctx.cache = new ContextCache();
  // TODO since this is done, whatever other call to authViewer that was needed no longer needed
  ctx.authViewer(viewer);
  return ctx;
}

export class ContextCache {
  loaders: Map<string, DataLoader<ID, {}>> = new Map();

  // only create as needed for the "requests" which need it
  getEntLoader(loaderOptions: SelectDataOptions) {
    //    console.log(loaderOptions);
    let l = this.loaders.get(loaderOptions.tableName);

    if (l) {
      //console.log("existing loader");
      return l;
    }
    l = createDataLoader(loaderOptions);
    this.loaders.set(loaderOptions.tableName, l);
    //console.log("new loader");
    return l;
  }

  // we have a per-table map to make it easier to purge and have less things to compare with
  private itemMap: Map<string, Map<string, {}>> = new Map();
  private listMap: Map<string, Map<string, {}[]>> = new Map();

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

  getCachedRows(options: queryOptions): {}[] | null {
    //    console.log("get", this.listMap);
    let m = this.listMap.get(options.tableName);
    if (!m) {
      return null;
    }
    let rows = m.get(this.getkey(options));
    //    console.log("rows money line", rows);
    return rows || null;
  }

  getCachedRow(options: queryOptions): {} | null {
    let m = this.itemMap.get(options.tableName);
    if (!m) {
      return null;
    }
    let row = m.get(this.getkey(options));
    return row || null;
  }

  primeCache(options: queryOptions, rows: {}[]): void;
  primeCache(options: queryOptions, rows: {}): void;
  primeCache(options: queryOptions, rows: {}[] | {}): void {
    if (Array.isArray(rows)) {
      let m = this.listMap.get(options.tableName) || new Map();
      m.set(this.getkey(options), rows);
      this.listMap.set(options.tableName, m);
      //console.log("post-prime", this.listMap);
    } else {
      let m = this.itemMap.get(options.tableName) || new Map();
      m.set(this.getkey(options), rows);
      this.itemMap.set(options.tableName, m);
      //console.log("post-prime", this.itemMap);
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
  clause: query.Clause;
  orderby?: string;
}
