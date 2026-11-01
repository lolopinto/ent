import {
  Data,
  EdgeQueryableDataOptions,
  EdgeQueryableDataOptionsConfigureLoader,
  Ent,
  ID,
  LoadEntOptions,
  QueryDataOptions,
  SelectBaseDataOptions,
  Viewer,
} from "../base";
import { AndOptional, Clause } from "../clause";
import {
  applyPrivacyPolicyForRows,
  getDefaultLimit,
  loadRow,
  loadRows,
} from "../ent";
import { AlwaysAllowPrivacyPolicy, applyPrivacyPolicy } from "../privacy";
import { memoizeNoArgs } from "../memoize";
import { OrderBy } from "../query_impl";

import { EdgeQuery, EdgeQueryFilter } from "./query";
import {
  emptyPaginationInfo,
  PaginationInfo,
  QueryPagination,
  RowQueryFilter,
} from "./pagination";

export interface CustomClauseQueryOptions<
  TDest extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
  TSource extends Ent<TViewer> | undefined = undefined,
> {
  loadEntOptions: LoadEntOptions<TDest, TViewer>;

  source?: TSource;
  clause: Clause;
  // query-name used to create loaders...
  // and then from there it does what it needs to do to do the right thing...
  name: string;
  // pass this if the primary sort (first column in orderby) column is unique and it'll be used for the cursor and used to
  // generate the query
  primarySortColIsUnique?: boolean;
  orderby?: OrderBy;

  // these next 3 are deprecated. use orderby
  // defaults to id
  // @deprecated use orderby
  sortColumn?: string;
  // @deprecated use orderby
  orderByDirection?: "ASC" | "DESC";
  // in Postgres, NULLS FIRST is the default for DESC order, and NULLS LAST otherwise.
  // @deprecated user orderby`
  nullsPlacement?: "first" | "last";

  disableTransformations?: boolean;

  joinBETA?: QueryDataOptions["join"];
}

function getClause<
  TDest extends Ent<TViewer>,
  TViewer extends Viewer,
  TSource extends Ent<TViewer> | undefined,
>(opts: CustomClauseQueryOptions<TDest, TViewer, TSource>) {
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

export class CustomClauseQuery<
  TDest extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
  TSource extends Ent<TViewer> | undefined = undefined,
> implements EdgeQuery<Ent, TDest, Data>
{
  private clause: Clause;
  private readonly source?: TSource;
  private readonly pagination: QueryPagination<Data>;
  private filters: RowQueryFilter<Data>[] = [];
  private pageInfo?: PaginationInfo;
  private limitAdded = false;
  private rowsStarted = false;
  private rowsLoaded = false;
  private defaultOptions?: EdgeQueryableDataOptionsConfigureLoader;
  private readonly authorize: () => Promise<boolean>;
  private readonly loadEdges: () => Promise<Data[]>;

  constructor(
    public viewer: TViewer,
    private options: CustomClauseQueryOptions<TDest, TViewer, TSource>,
  ) {
    let orderby: OrderBy;
    let primarySortCol: string;

    if (
      options.orderby &&
      (options.sortColumn || options.orderByDirection || options.nullsPlacement)
    ) {
      throw new Error(
        `cannot pass orderby and sortColumn|orderByDirection|nullsPlacement`,
      );
    }
    if (options.orderby) {
      primarySortCol = options.orderby[0].column;
      orderby = options.orderby;
    } else {
      primarySortCol = options.sortColumn || "id";
      orderby = [
        {
          column: primarySortCol,
          direction: options.orderByDirection ?? "DESC",
          nullsPlacement: options.nullsPlacement,
        },
      ];
    }
    let cursorCol = options.primarySortColIsUnique
      ? primarySortCol
      : options.loadEntOptions.loaderFactory.options?.key || "id";

    this.pagination = new QueryPagination(
      {
        orderby,
        cursorCol,
        joinBETA: options.joinBETA,
        fieldOptions: options.loadEntOptions,
      },
      (row) => this.getCursor(row),
    );
    this.clause = getClause(options);
    this.source = options.source;
    this.authorize = memoizeNoArgs(async () =>
      applyPrivacyPolicy(this.viewer, this.getPrivacyPolicy(), this.source),
    );
    this.loadEdges = memoizeNoArgs(this.loadEdgesImpl.bind(this));
  }

  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  first(n: number, after?: string): this {
    this.assertRowsNotStarted("first");
    this.limitAdded = true;
    this.filters.push(this.pagination.first(n, after));
    return this;
  }

  last(n: number, before?: string): this {
    this.assertRowsNotStarted("last");
    this.limitAdded = true;
    this.filters.push(this.pagination.last(n, before));
    return this;
  }

  private assertRowsNotStarted(method: string) {
    if (this.rowsStarted) {
      throw new Error(`cannot call ${method} after query is dispatched`);
    }
  }

  protected getCursorCol(): string {
    return this.options.primarySortColIsUnique
      ? (this.options.orderby?.[0].column ?? this.options.sortColumn ?? "id")
      : (this.options.loadEntOptions.loaderFactory.options?.key ?? "id");
  }

  protected configureEdgeQueryableDataOptions(
    options: EdgeQueryableDataOptionsConfigureLoader,
  ) {
    this.defaultOptions = options;
  }

  protected getDefaultEdgeQueryOptions() {
    return this.defaultOptions;
  }

  protected __assertNoFiltersBETA(name: string) {
    if (this.filters.length) {
      throw new Error(`${name} must be the first filter called`);
    }
  }

  // Adapter for the legacy source-keyed filter API. Query execution itself
  // has one row list and never manufactures a source for authorization.
  __addCustomFilterBETA(filter: EdgeQueryFilter<Data>) {
    this.assertRowsNotStarted("__addCustomFilterBETA");
    this.filters.push({
      fetch: filter.fetch?.bind(filter),
      query: filter.query?.bind(filter),
      filter: filter.filter
        ? (rows) => filter.filter!(this.compatibilityKey(), rows)
        : undefined,
      paginationInfo: filter.paginationInfo
        ? () => filter.paginationInfo!(this.compatibilityKey())
        : undefined,
    });
  }

  async sourceEnt(_id: ID) {
    return this.source ?? null;
  }

  getTableName() {
    return this.options.loadEntOptions.tableName;
  }

  async queryRawCount(): Promise<number> {
    if (!(await this.authorize())) {
      return 0;
    }

    // sqlite needs as count otherwise it returns count(1)
    let fields: SelectBaseDataOptions["fields"] = ["count(1) as count"];
    if (this.options.joinBETA) {
      const firstRequestedField = this.options.loadEntOptions.fields[0];
      const alias =
        this.options.loadEntOptions.fieldsAlias ??
        this.options.loadEntOptions.alias;
      const fieldString =
        typeof firstRequestedField === "object"
          ? "expression" in firstRequestedField
            ? (() => {
                throw new Error(
                  "join-backed raw counts do not support computed select expressions",
                );
              })()
            : `${firstRequestedField.alias}.${firstRequestedField.column}`
          : alias
            ? `${alias}.${firstRequestedField}`
            : firstRequestedField;
      fields = [`count(distinct ${fieldString}) as count`];
    }
    const row = await loadRow({
      ...this.options.loadEntOptions,
      tableName: this.options.loadEntOptions.tableName,
      fields,
      clause: this.clause,
      context: this.viewer.context,
      join: this.options.joinBETA,
      disableFieldsAlias: true,
    });
    return parseInt(row?.count, 10) || 0;
  }

  async queryAllRawCount(): Promise<Map<ID, number>> {
    throw new Error(`queryAllRawCount doesn't make sense in CustomClauseQuery`);
  }

  private async loadEdgesImpl(): Promise<Data[]> {
    if (!this.limitAdded) {
      this.first(getDefaultLimit());
    }
    this.rowsStarted = true;
    if (!(await this.authorize())) {
      this.rowsLoaded = true;
      return [];
    }
    let options: EdgeQueryableDataOptions = { ...this.defaultOptions };
    for (const filter of this.filters) {
      if (!filter.query) {
        break;
      }
      if (filter.fetch) {
        throw new Error(
          "a filter that augments the query cannot currently fetch",
        );
      }
      options = await filter.query(options);
    }
    let rows = await this.loadRawData(options);
    for (const filter of this.filters) {
      await filter.fetch?.();
    }
    for (const filter of this.filters) {
      rows = filter.filter ? filter.filter(rows) : rows;
      this.pageInfo = filter.paginationInfo?.() ?? this.pageInfo;
    }
    this.rowsLoaded = true;
    return rows;
  }

  protected async loadRawData(
    options: EdgeQueryableDataOptions,
  ): Promise<Data[]> {
    if (!options.orderby) {
      options.orderby = [
        {
          column: this.getCursorCol(),
          direction: this.options.orderByDirection ?? "DESC",
          nullsPlacement: this.options.nullsPlacement,
        },
      ];
    }
    if (!options.limit) {
      options.limit = getDefaultLimit();
    }

    const rows = await loadRows({
      ...this.options.loadEntOptions,
      clause: AndOptional(this.clause, options.clause),
      orderby: options.orderby,
      limit: options?.limit || getDefaultLimit(),
      context: this.viewer.context,
      join: this.options.joinBETA,
      // if doing a join, select distinct rows
      distinct: this.options.joinBETA !== undefined,
    });

    return rows;
  }

  dataToID(edge: Data): ID {
    return edge.id;
  }

  protected async loadEntsFromEdges(_id: ID, rows: Data[]): Promise<TDest[]> {
    return applyPrivacyPolicyForRows(
      this.viewer,
      rows,
      this.options.loadEntOptions,
    );
  }

  readonly queryEdges = async (): Promise<Data[]> => this.loadEdges();

  readonly queryIDs = async (): Promise<ID[]> =>
    (await this.loadEdges()).map((row) => this.dataToID(row));

  readonly queryCount = async (): Promise<number> =>
    (await this.loadEdges()).length;

  readonly queryEnts = async (): Promise<TDest[]> =>
    this.loadEntsFromEdges(this.compatibilityKey(), await this.loadEdges());

  getCursor(row: Data): string {
    return this.pagination.getCursor(row);
  }

  async queryPageInfo(): Promise<PaginationInfo> {
    await this.loadEdges();
    return this.pageInfo ?? emptyPaginationInfo();
  }

  // Keep the public grouped APIs as adapters for existing consumers. Their
  // keys identify output only; they are never supplied to a privacy policy.
  private compatibilityKey(): ID {
    return this.source?.id ?? 1;
  }

  readonly queryAllEdges = async (): Promise<Map<ID, Data[]>> =>
    new Map([[this.compatibilityKey(), await this.queryEdges()]]);

  readonly queryAllIDs = async (): Promise<Map<ID, ID[]>> =>
    new Map([[this.compatibilityKey(), await this.queryIDs()]]);

  readonly queryAllEnts = async (): Promise<Map<ID, TDest[]>> =>
    new Map([[this.compatibilityKey(), await this.queryEnts()]]);

  readonly queryAllCount = async (): Promise<Map<ID, number>> =>
    new Map([[this.compatibilityKey(), await this.queryCount()]]);

  paginationInfo(): Map<ID, PaginationInfo> {
    if (!this.rowsLoaded) {
      throw new Error("cannot call paginationInfo until query is dispatched");
    }
    return this.pageInfo
      ? new Map([[this.compatibilityKey(), this.pageInfo]])
      : new Map();
  }

  __getOptions() {
    return this.options;
  }
}
