import DataLoader from "dataloader";
import { Context } from "./context";
import {
  LoadRowOptions,
  ID,
  Data,
  SelectDataOptions,
  createDataLoader,
  DataOptions,
  loadRow,
  createCountDataLoader,
} from "./ent";
import * as clause from "./clause";
import { log } from "./logger";

export interface LoaderFactory<T, V> {
  name: string; // used to have a per-request cache of each loader type

  // having Context here as opposed to fetch can mean we have different loaders if we care about Context
  // or it can just be completely ignored!
  createLoader(context?: Context): Loader<T, V>;
}

export interface Loader<T, V> {
  context?: Context;
  // maybe Context will be used to make different decisions
  load(key: T): Promise<V | null>;
}

// this is like factory factory FML
// helper function to handle context vs not
// and to keep the API clean for clients who shouldn't have to worry about this
function getLoader<T, V>(
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
  return context.cache.getRealLoader(factory.name, create);
}

export class ObjectLoader implements Loader<ID, Data> {
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
    const row = await loadRow(rowOptions);
    return null;
  }
}

export class ObjectLoaderFactory implements LoaderFactory<ID, Data> {
  name: string;
  constructor(private options: SelectDataOptions) {
    this.name = options.tableName;
  }

  createLoader(context?: Context) {
    return getLoader(
      this,
      () => new ObjectLoader(this.options, context),
      context,
    );
  }
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
