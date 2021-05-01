import DataLoader from "dataloader";
import {
  LoadRowOptions,
  ID,
  SelectDataOptions,
  DataOptions,
  Context,
  Loader,
  LoaderFactory,
} from "../base";
import { loadRow, loadRows } from "../ent";
import * as clause from "../clause";
import { logEnabled } from "../logger";
import { cacheMap, getLoader } from "./loader";

export function createCountDataLoader(
  options: DataOptions,
  col: string,
  extraClause?: clause.Clause,
) {
  const loaderOptions: DataLoader.Options<ID, number> = {};

  // if query logging is enabled, we should log what's happening with loader
  if (logEnabled("query")) {
    loaderOptions.cacheMap = new cacheMap(options);
  }

  return new DataLoader(async (keys: ID[]) => {
    if (!keys.length) {
      return [];
    }

    // keep query simple if we're only fetching for one id
    if (keys.length == 1) {
      let cls: clause.Clause = clause.Eq(col, keys[0]);
      if (extraClause) {
        cls = clause.And(cls, extraClause);
      }
      const row = await loadRow({
        ...options,
        fields: ["count(1)"],
        clause: cls,
      });
      return [parseInt(row?.count, 10) || 0];
    }
    let cls: clause.Clause = clause.In(col, ...keys);
    if (extraClause) {
      cls = clause.And(cls, extraClause);
    }

    let m = new Map<ID, number>();
    let result: number[] = [];
    for (let i = 0; i < keys.length; i++) {
      result.push(0);
      // store the index....
      m.set(keys[i], i);
    }

    const rowOptions: LoadRowOptions = {
      ...options,
      fields: ["count(1)", col],
      groupby: col,
      clause: cls,
    };
    const rows = await loadRows(rowOptions);

    for (const row of rows) {
      const id = row[col];
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
export class RawCountLoader implements Loader<ID, number> {
  private loader: DataLoader<ID, number> | undefined;
  // tableName, columns
  constructor(
    private options: DataOptions,
    private col: string,
    public context?: Context,
  ) {
    if (context) {
      this.loader = createCountDataLoader(options, this.col);
    }
  }

  async load(id: ID): Promise<number> {
    if (this.loader) {
      return await this.loader.load(id);
    }

    const row = await loadRow({
      ...this.options,
      fields: ["count(1)"],
      clause: clause.Eq(this.col, id),
    });
    return parseInt(row?.count, 10) || 0;
  }

  clearAll() {
    this.loader && this.loader.clearAll();
  }
}

export class RawCountLoaderFactory implements LoaderFactory<ID, number> {
  name: string;
  constructor(private options: SelectDataOptions, private col: string) {
    this.name = `${options.tableName}:${this.col}`;
  }

  createLoader(context?: Context) {
    return getLoader(
      this,
      () => new RawCountLoader(this.options, this.col, context),
      context,
    );
  }
}
