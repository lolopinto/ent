import DataLoader from "dataloader";
import {
  LoadRowOptions,
  ID,
  Data,
  SelectDataOptions,
  DataOptions,
  Context,
  Loader,
  LoaderFactory,
} from "../base";
import { loadRow, loadRows } from "../ent";
import * as clause from "../clause";
import { log, logEnabled } from "../logger";

import { getLoader, cacheMap } from "./loader";

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

    let m = new Map<ID, number>();
    let result: (Data | null)[] = [];
    for (let i = 0; i < ids.length; i++) {
      result.push(null);
      // store the index....
      m.set(ids[i], i);
    }

    // context not needed because we're creating a loader which has its own cache which is being used here
    const rows = await loadRows(rowOptions);
    for (const row of rows) {
      const id = row[col];
      const idx = m.get(id);
      if (idx === undefined) {
        throw new Error(
          `malformed query. got ${id} back but didn't query for it`,
        );
      }
      result[idx] = row;
    }

    return result;
  }, loaderOptions);
}

export class ObjectLoader implements Loader<ID, Data | null> {
  private loader: DataLoader<ID, Data> | undefined;
  constructor(private options: SelectDataOptions, public context?: Context) {
    if (context) {
      this.loader = createDataLoader(options);
    }
  }

  async load(id: ID): Promise<Data | null> {
    // simple case. we get parallelization etc
    if (this.loader) {
      return await this.loader.load(id);
    }

    // fetch every time
    const col = this.options.pkey || "id";

    const rowOptions: LoadRowOptions = {
      ...this.options,
      clause: clause.Eq(col, id),
      context: this.context,
    };
    return await loadRow(rowOptions);
  }
}

export class ObjectLoaderFactory implements LoaderFactory<ID, Data | null> {
  name: string;
  constructor(private options: SelectDataOptions) {
    this.name = `${options.tableName}:${options.pkey || "id"}`;
  }

  createLoader(context?: Context) {
    return getLoader(
      this,
      () => new ObjectLoader(this.options, context),
      context,
    );
  }
}
