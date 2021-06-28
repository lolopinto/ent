import DataLoader from "dataloader";
import {
  LoadRowOptions,
  ID,
  DataOptions,
  Context,
  Loader,
  LoaderFactory,
  SelectBaseDataOptions,
} from "../base";
import { loadRow, loadRows } from "../ent";
import * as clause from "../clause";
import { logEnabled } from "../logger";
import { cacheMap, getLoader } from "./loader";

interface QueryCountOptions {
  tableName: string;

  // must provide at least one or both of these
  // if groupCol provided, we can do group by queries for multiple
  // if not, can't group. similar philosophy to QueryLoader
  groupCol?: string;
  clause?: clause.Clause;
}

async function simpleCase<K extends any>(
  options: QueryCountOptions,
  key: K,
  context?: Context,
) {
  let cls: clause.Clause;
  if (options.groupCol && options.clause) {
    cls = clause.And(clause.Eq(options.groupCol, key), options.clause);
  } else if (options.groupCol) {
    cls = clause.Eq(options.groupCol, key);
  } else if (options.clause) {
    cls = options.clause;
  } else {
    throw new Error(`need options.groupCol or options.clause`);
  }

  const row = await loadRow({
    ...options,
    // sqlite needs as count otherwise it returns count(1)
    fields: ["count(1) as count"],
    clause: cls,
    context,
  });
  return [parseInt(row?.count, 10) || 0];
}

export function createCountDataLoader<K extends any>(
  options: QueryCountOptions,
) {
  const loaderOptions: DataLoader.Options<K, number> = {};

  // if query logging is enabled, we should log what's happening with loader
  if (logEnabled("query")) {
    loaderOptions.cacheMap = new cacheMap(options);
  }

  return new DataLoader(async (keys: K[]) => {
    if (!keys.length) {
      return [];
    }

    // keep query simple if we're only fetching for one id
    if (keys.length == 1 || !options.groupCol) {
      return simpleCase(options, keys[0]);
    }

    let cls: clause.Clause = clause.In(options.groupCol, ...keys);
    if (options.clause) {
      cls = clause.And(cls, options.clause);
    }

    let m = new Map<K, number>();
    let result: number[] = [];
    for (let i = 0; i < keys.length; i++) {
      result.push(0);
      // store the index....
      m.set(keys[i], i);
    }

    const rowOptions: LoadRowOptions = {
      ...options,
      fields: ["count(1) as count", options.groupCol],
      groupby: options.groupCol,
      clause: cls,
    };

    const rows = await loadRows(rowOptions);

    for (const row of rows) {
      const id = row[options.groupCol];
      const idx = m.get(id);
      if (idx === undefined) {
        throw new Error(
          `malformed query. got ${id} back but didn't query for it`,
        );
      }
      result[idx] = parseInt(row.count, 10);
    }
    return result;
  }, loaderOptions);
}

// for now this only works for single column counts
// e.g. foreign key count
export class RawCountLoader<K extends any> implements Loader<K, number> {
  private loader: DataLoader<K, number> | undefined;
  // tableName, columns
  constructor(private options: QueryCountOptions, public context?: Context) {
    if (context && options.groupCol) {
      this.loader = createCountDataLoader(options);
    }
  }

  async load(id: K): Promise<number> {
    if (this.loader) {
      return await this.loader.load(id);
    }

    const rows = await simpleCase(this.options, id, this.context);
    return rows[0];
  }

  clearAll() {
    this.loader && this.loader.clearAll();
  }
}

export class RawCountLoaderFactory implements LoaderFactory<ID, number> {
  name: string;
  private options: QueryCountOptions;
  constructor(options: SelectBaseDataOptions, col: string);
  constructor(options: QueryCountOptions);
  constructor(
    options: SelectBaseDataOptions | QueryCountOptions,
    col?: string,
  ) {
    if (typeof col === "string") {
      // old API
      this.options = {
        ...options,
        groupCol: col,
      };
    } else {
      this.options = options;
    }
    if (this.options.groupCol) {
      this.name = `${this.options.tableName}:${this.options.groupCol}`;
    } else if (this.options.clause) {
      this.name = `${
        this.options.tableName
      }:${this.options.clause.instanceKey()}`;
    } else {
      throw new Error(
        `must pass at least one of groupCol and clause to QueryLoaderFactory`,
      );
    }
  }

  createLoader(context?: Context) {
    return getLoader(
      this,
      () => new RawCountLoader(this.options, context),
      context,
    );
  }
}
