import {
  Data,
  Ent,
  ID,
  EdgeQueryableDataOptions,
  LoadEntOptions,
  Viewer,
  LoaderFactory,
  ConfigurableLoaderFactory,
} from "../base";
import { AndOptional, Clause } from "../clause";
import { applyPrivacyPolicyForRows, DefaultLimit } from "../ent";
import {
  ObjectLoaderFactory,
  QueryLoaderFactory,
  RawCountLoader,
} from "../loaders";
import { BaseEdgeQuery, IDInfo, EdgeQuery } from "./query";

export interface CustomEdgeQueryOptionsDeprecated<
  TSource extends Ent<TViewer>,
  TDest extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
> {
  src: TSource | ID;
  countLoaderFactory: LoaderFactory<ID, number>;
  dataLoaderFactory: ConfigurableLoaderFactory<ID, Data[]>;
  options: LoadEntOptions<TDest, TViewer>;
  // defaults to created_at
  sortColumn?: string;
}

export interface CustomEdgeQueryOptions<
  TSource extends Ent<TViewer>,
  TDest extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
> {
  src: TSource | ID;
  loadEntOptions: LoadEntOptions<TDest, TViewer>;
  // must provide at least one of these
  groupCol?: string;
  clause?: Clause;
  // query-name used to create loaders...
  // and then from there it does what it needs to do to do the right thing...
  name: string;
  // defaults to id
  sortColumn?: string;
  // pass this if the sort column is unique and it'll be used for the cursor and used to
  // generate the query
  sortColumnUnique?: boolean;

  disableTransformations?: boolean;
}

function getClause<
  TSource extends Ent<TViewer>,
  TDest extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
>(opts: CustomEdgeQueryOptions<TSource, TDest, TViewer>) {
  let cls = opts.clause;
  if (opts.disableTransformations) {
    return cls;
  }
  let optClause = opts.loadEntOptions.loaderFactory?.options?.clause;
  if (typeof optClause === "function") {
    optClause = optClause();
  }
  if (!optClause) {
    return cls;
  }
  return AndOptional(cls, optClause);
}

function getRawCountLoader<
  TSource extends Ent<TViewer>,
  TDest extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
>(viewer: TViewer, opts: CustomEdgeQueryOptions<TSource, TDest, TViewer>) {
  if (!viewer.context?.cache) {
    return new RawCountLoader({
      tableName: opts.loadEntOptions.tableName,
      groupCol: opts.groupCol,
      clause: getClause(opts),
    });
  }
  const name = `custom_query_count_loader:${opts.name}`;
  return viewer.context.cache.getLoader(
    name,
    () =>
      new RawCountLoader({
        tableName: opts.loadEntOptions.tableName,
        groupCol: opts.groupCol,
        clause: getClause(opts),
      }),
  ) as RawCountLoader<ID>;
}

function getQueryLoader<
  TSource extends Ent<TViewer>,
  TDest extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
>(
  viewer: TViewer,
  opts: CustomEdgeQueryOptions<TSource, TDest, TViewer>,
  options: EdgeQueryableDataOptions,
) {
  const loader = opts.loadEntOptions.loaderFactory as ObjectLoaderFactory<ID>;
  const name = `custom_query_loader:${opts.name}`;

  return QueryLoaderFactory.createConfigurableLoader(
    name,
    {
      tableName: opts.loadEntOptions.tableName,
      fields: opts.loadEntOptions.fields,
      groupCol: opts.groupCol,
      clause: getClause(opts),
      toPrime: [loader],
    },
    options,
    viewer.context,
  );
}

function isDeprecatedOptions<
  TSource extends Ent<TViewer>,
  TDest extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
>(
  options:
    | CustomEdgeQueryOptionsDeprecated<TSource, TDest, TViewer>
    | CustomEdgeQueryOptions<TSource, TDest, TViewer>,
): options is CustomEdgeQueryOptionsDeprecated<TSource, TDest, TViewer> {
  return (
    (options as CustomEdgeQueryOptionsDeprecated<TSource, TDest, TViewer>)
      .countLoaderFactory !== undefined
  );
}

export abstract class CustomEdgeQueryBase<
    TSource extends Ent<TViewer>,
    TDest extends Ent<TViewer>,
    TViewer extends Viewer = Viewer,
  >
  extends BaseEdgeQuery<TSource, TDest, Data>
  implements EdgeQuery<TSource, TDest, Data>
{
  private id: ID;
  private opts: LoadEntOptions<TDest>;
  constructor(
    public viewer: TViewer,
    private options:
      | CustomEdgeQueryOptionsDeprecated<TSource, TDest, TViewer>
      | CustomEdgeQueryOptions<TSource, TDest, TViewer>,
  ) {
    let opts: LoadEntOptions<TDest>;
    // TODO this is changing to id...
    let defaultSort = "created_at";

    let uniqueColIsSort = false;

    if (isDeprecatedOptions(options)) {
      opts = options.options;
    } else {
      opts = options.loadEntOptions;
      // uniqueCol = options.sortColumn || defaultSort;
      if (options.sortColumnUnique) {
        uniqueColIsSort = true;
      }
    }
    let uniqueCol = opts.loaderFactory.options?.key || "id";

    if (uniqueColIsSort) {
      uniqueCol = options.sortColumn || defaultSort;
    }
    // // let uniqueCol = "id";
    options.sortColumn = options.sortColumn || defaultSort;
    super(viewer, options.sortColumn, uniqueCol);
    if (typeof options.src === "object") {
      this.id = options.src.id;
    } else {
      this.id = options.src;
    }

    this.opts = opts;
  }

  getTableName(): string {
    return this.opts.tableName;
  }

  getUniqueColumn(): string {
    return this.opts.loaderFactory.options?.key || "id";
  }

  abstract sourceEnt(id: ID): Promise<Ent | null>;

  private async idVisible() {
    const ids = await this.genIDInfosToFetch();
    if (ids.length !== 1) {
      throw new Error("invalid number of IDInfo");
    }
    return !ids[0].invalidated;
  }

  private getCountLoader() {
    if (isDeprecatedOptions(this.options)) {
      return this.options.countLoaderFactory.createLoader(this.viewer.context);
    }
    return getRawCountLoader(this.viewer, this.options);
  }

  private getQueryLoader(options: EdgeQueryableDataOptions) {
    if (isDeprecatedOptions(this.options)) {
      return this.options.dataLoaderFactory.createConfigurableLoader(
        options,
        this.viewer.context,
      );
    }
    return getQueryLoader(this.viewer, this.options, options);
  }

  async queryRawCount(): Promise<number> {
    const idVisible = await this.idVisible();
    if (!idVisible) {
      return 0;
    }

    return this.getCountLoader().load(this.id);
  }

  async queryAllRawCount(): Promise<Map<ID, number>> {
    let count = 0;
    const idVisible = await this.idVisible();
    if (idVisible) {
      count = await this.queryRawCount();
    }
    return new Map<ID, number>([[this.id, count]]);
  }

  protected async loadRawIDs(
    addID: (src: ID | TSource) => void,
  ): Promise<void> {
    addID(this.options.src);
  }

  protected async loadRawData(
    infos: IDInfo[],
    options: EdgeQueryableDataOptions,
  ) {
    if (infos.length !== 1) {
      throw new Error(
        `expected 1 info passed to loadRawData. ${infos.length} passed`,
      );
    }
    if (!options.orderby) {
      options.orderby = `${this.options.sortColumn} DESC`;
    }
    if (!options.limit) {
      options.limit = DefaultLimit;
    }
    const loader = this.getQueryLoader(options);
    const info = infos[0];
    if (info.invalidated) {
      this.edges.set(this.id, []);
      return;
    }
    const rows = await loader.load(this.id);

    this.edges.set(this.id, rows);
  }

  dataToID(edge: Data): ID {
    return edge.id;
  }

  protected async loadEntsFromEdges(id: ID, rows: Data[]): Promise<TDest[]> {
    return applyPrivacyPolicyForRows(this.viewer, rows, this.opts);
  }
}
