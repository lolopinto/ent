import { IncomingMessage, ServerResponse } from "http";
import { Data, Loader, LoaderWithLoadMany, QueryOptions, Viewer } from "./base";

import { Context } from "./base";
import { log } from "./logger";
import { stableStringify } from "./cache_utils";
import { getOnQueryCacheHit } from "./metrics";

const DEFAULT_MAX_DISCARDED_LOADERS = 1000;
let maxDiscardedLoaders = DEFAULT_MAX_DISCARDED_LOADERS;

export function getContextCacheMaxDiscardedLoaders(): number {
  return maxDiscardedLoaders;
}

export function setContextCacheMaxDiscardedLoaders(size?: number | null) {
  if (size === undefined || size === null) {
    maxDiscardedLoaders = DEFAULT_MAX_DISCARDED_LOADERS;
    return;
  }
  if (!Number.isFinite(size) || size < 0) {
    throw new Error(`maxDiscardedLoaders must be a non-negative number`);
  }
  maxDiscardedLoaders = Math.floor(size);
}

// RequestBasedContext e.g. from an HTTP request with a server/response conponent
export interface RequestContext<TViewer extends Viewer = Viewer>
  extends Context<TViewer> {
  authViewer(viewer: TViewer): Promise<void>; //logs user in and changes viewer to this
  logout(): Promise<void>;
  request: IncomingMessage;
  response: ServerResponse;
}

export function getContextCacheKey(options: QueryOptions): string {
  const fields = options.fields
    .map((f) => {
      if (typeof f === "object") {
        return `${f.alias}.${f.column}`;
      }
      return f;
    })
    .join(",");
  const parts: string[] = [
    `fields:${fields}`,
    `clause:${options.clause.instanceKey()}`,
  ];
  if (options.distinct !== undefined) {
    parts.push(`distinct:${options.distinct}`);
  }
  if (options.alias !== undefined) {
    parts.push(`alias:${options.alias}`);
  }
  if (options.fieldsAlias !== undefined) {
    parts.push(`fieldsAlias:${options.fieldsAlias}`);
  }
  if (options.disableFieldsAlias !== undefined) {
    parts.push(`disableFieldsAlias:${options.disableFieldsAlias}`);
  }
  if (options.disableDefaultOrderByAlias !== undefined) {
    parts.push(`disableDefaultOrderByAlias:${options.disableDefaultOrderByAlias}`);
  }
  if (options.groupby !== undefined) {
    parts.push(`groupby:${options.groupby}`);
  }
  if (options.orderby) {
    parts.push(`orderby:${stableStringify(options.orderby)}`);
  }
  if (options.join) {
    const joinKey = options.join.map((join) => ({
      type: join.type ?? "inner",
      tableName: join.tableName,
      alias: join.alias,
      clause: join.clause.instanceKey(),
    }));
    parts.push(`join:${stableStringify(joinKey)}`);
  }
  if (options.limit !== undefined) {
    parts.push(`limit:${options.limit}`);
  }
  if (options.offset !== undefined) {
    parts.push(`offset:${options.offset}`);
  }
  return parts.join(",");
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

  getCachedRows(options: QueryOptions): Data[] | null {
    let m = this.listMap.get(options.tableName);
    if (!m) {
      return null;
    }
    const key = getContextCacheKey(options);
    let rows = m.get(key);
    if (rows) {
      const hook = getOnQueryCacheHit();
      if (hook) {
        hook({
          tableName: options.tableName,
          key,
        });
      }
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
    const key = getContextCacheKey(options);
    let row = m.get(key);
    if (row) {
      const hook = getOnQueryCacheHit();
      if (hook) {
        hook({
          tableName: options.tableName,
          key,
        });
      }
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
      m.set(getContextCacheKey(options), rows);
      this.listMap.set(options.tableName, m);
    } else {
      let m = this.itemMap.get(options.tableName) || new Map();
      m.set(getContextCacheKey(options), rows);
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

    if (maxDiscardedLoaders === 0) {
      this.discardedLoaders = [];
      return;
    }
    if (this.discardedLoaders.length > maxDiscardedLoaders) {
      this.discardedLoaders = this.discardedLoaders.slice(
        -maxDiscardedLoaders,
      );
    }
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
