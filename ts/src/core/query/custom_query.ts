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
import { Clause, getCombinedClause } from "../clause";
import { applyPrivacyPolicyForRows, getDefaultLimit } from "../ent";
import {
  ObjectLoaderFactory,
  QueryLoaderFactory,
  RawCountLoader,
} from "../loaders";
import { OrderBy } from "../query_impl";
import { BaseEdgeQuery, IDInfo, EdgeQuery } from "./query";

// TODO kill this. only used in graphql tests
export interface CustomEdgeQueryOptionsDeprecated<
  TSource extends Ent<TViewer>,
  TDest extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
> {
  src: TSource | ID;
  countLoaderFactory: LoaderFactory<ID, number>;
  dataLoaderFactory: ConfigurableLoaderFactory<ID, Data[]>;
  options: LoadEntOptions<TDest, TViewer>;
  // defaults to id
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
  // @deprecated use orderby
  sortColumn?: string;
  orderby?: OrderBy;
  // pass this if the primary sort (first column in orderby) column is unique and it'll be used for the cursor and used to
  // generate the query
  primarySortColIsUnique?: boolean;

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
  return getCombinedClause(
    opts.loadEntOptions.loaderFactory?.options,
    cls,
    true,
  );
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
  console.debug(opts.name);
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
  const loader = opts.loadEntOptions.loaderFactory as ObjectLoaderFactory<Data>;
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
    let defaultSort = "id";

    let uniqueColIsSort = false;

    let orderby: OrderBy | undefined;
    let sortCol: string | undefined;

    if (isDeprecatedOptions(options)) {
      opts = options.options;
    } else {
      opts = options.loadEntOptions;
      if (options.primarySortColIsUnique) {
        uniqueColIsSort = true;
      }
      if (options.orderby) {
        orderby = options.orderby;
        sortCol = options.orderby[0].column;
      }
    }
    let uniqueCol = opts.loaderFactory.options?.key || "id";

    if (!orderby) {
      options.sortColumn = options.sortColumn || defaultSort;
      sortCol = options.sortColumn;

      orderby = [
        {
          column: options.sortColumn,
          direction: "DESC",
        },
      ];
    }

    if (uniqueColIsSort) {
      uniqueCol = sortCol || defaultSort;
    }
    super(viewer, {
      cursorCol: uniqueCol,
      orderby,
    });
    if (typeof options.src === "object") {
      this.id = options.src.id;
    } else {
      this.id = options.src;
    }

    this.opts = opts;
  }

  getTableName() {
    return this.opts.tableName;
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
      options.orderby = [
        {
          column: this.getSortCol(),
          direction: "DESC",
        },
      ];
    }
    if (!options.limit) {
      options.limit = getDefaultLimit();
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
