import memoize from "memoizee";
import { isPromise } from "util/types";
import {
  Data,
  EdgeQueryableDataOptions,
  EdgeQueryableDataOptionsConfigureLoader,
  Ent,
  ID,
  PrivacyPolicy,
  QueryableDataOptions,
  SelectBaseDataOptions,
  Viewer,
} from "../base";
import * as clause from "../clause";
import { getCursor, getDefaultLimit } from "../ent";
import { AlwaysAllowPrivacyPolicy, applyPrivacyPolicy } from "../privacy";
import { OrderBy, reverseOrderBy } from "../query_impl";

export interface EdgeQuery<
  TSource extends Ent,
  TDest extends Ent,
  TEdge extends Data,
> {
  // if more than one, the single-version methods should throw

  // TODO determine if these should return null if the edge isn't visible
  // might be helpful to have the distinction in the API where null = privacy check failed and []|0 etc equals no data
  queryEdges(): Promise<TEdge[]>;
  queryAllEdges(): Promise<Map<ID, TEdge[]>>;
  queryIDs(): Promise<ID[]>;
  queryAllIDs(): Promise<Map<ID, ID[]>>;
  queryCount(): Promise<number>;
  queryAllCount(): Promise<Map<ID, number>>;
  queryRawCount(): Promise<number>;
  queryAllRawCount(): Promise<Map<ID, number>>;
  queryEnts(): Promise<TDest[]>;
  queryAllEnts(): Promise<Map<ID, TDest[]>>;

  first(n: number, after?: string): EdgeQuery<TSource, TDest, TEdge>;
  last(n: number, before?: string): EdgeQuery<TSource, TDest, TEdge>;

  paginationInfo(): Map<ID, PaginationInfo>;
  getCursor(row: TEdge): string;
  dataToID(edge: TEdge): ID;

  getPrivacyPolicy(): PrivacyPolicy;

  // there's no requirement that you have to be able to see
  // an ent to see edges from that ent so the ent is optional
  // however, a few privacy policies and rules are dependent on the Ent so we try and load
  // the Ent if the ent isn't passed as the source to the query.
  // If the Viewer can see the Ent, that's what's passed to the Privacy Policies
  // to determine if the edge is visible
  sourceEnt(id: ID): Promise<Ent | null>;
}

//maybe id2 shouldn't return EdgeQuery but a different object from which you can query edge. the ent you don't need to query since you can just query that on your own.

export interface EdgeQueryFilter<T extends Data> {
  // filter that needs to fetch data before it can be applied
  // should not be used in conjunction with query
  fetch?(): Promise<void>;

  // this is a filter that does the processing in TypeScript instead of (or in addition to) the SQL layer
  filter?(id: ID, edges: T[]): T[];

  // there's 2 ways to do it.
  // apply it in SQL
  // or process it after the fact
  query?(
    options: EdgeQueryableDataOptions,
  ): EdgeQueryableDataOptions | Promise<EdgeQueryableDataOptions>;
  // maybe it's a dynamic decision to do so and then query returns what was passed to it and filter returns what was passed to it based on the decision flow
  //  preProcess

  // filter affects pagination.
  // If filter implements this and returns a value, we use that info for the pagination details
  // if we somehow have multiple filters in a query that use this, behavior is undefined
  paginationInfo?(id: ID): PaginationInfo | undefined;
}

export interface PaginationInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string;
  endCursor: string;
}

// TODO can we generalize EdgeQuery to support any clause
function assertPositive(n: number) {
  if (n < 0) {
    throw new Error("cannot use a negative number");
  }
}

interface validCursorOptions {
  keys: string[];
}

export type CursorKeyValues = [key: string, value: string | number | null][];

function translateCursorToKeyValues(
  cursor: string,
  opts: validCursorOptions,
): CursorKeyValues {
  const { keys } = opts;
  const decoded = atob(cursor);
  let cursorData: CursorKeyValues = [];
  try {
    cursorData = JSON.parse(decoded);
  } catch (error) {
    throw new Error(`Bad cursor format ${cursor} passed`);
  }
  // invalid or unknown cursor. nothing to do here.
  // we should have the same number of parts as keys
  if (cursorData.length !== keys.length) {
    throw new Error(`invalid cursor ${cursor} passed`);
  }
  return cursorData;
}

interface FilterOptions<T extends Data> {
  limit: number;
  query: BaseEdgeQuery<Ent, Ent, T>;
  cursorCol: string;
  orderby: OrderBy;

  cursorKeys: string[];

  // fieldOptions used to query field values
  // used for alias
  fieldOptions?: SelectBaseDataOptions;
}

interface FirstFilterOptions<T extends Data> extends FilterOptions<T> {
  after?: string;
}

interface LastFilterOptions<T extends Data> extends FilterOptions<T> {
  before?: string;
}

const orderbyRegex = new RegExp(/([0-9a-z_]+)[ ]?([0-9a-z_]+)?/i);

class FirstFilter<T extends Data> implements EdgeQueryFilter<T> {
  /**
   * The offset is the value of the last key in the cursor, which is the primary key for the table
   */
  private offset: string | number | undefined;
  private edgeQuery: BaseEdgeQuery<Ent, Ent, T>;
  private pageMap: Map<ID, PaginationInfo> = new Map();
  private usedQuery = false;
  private cursorKeyValues: CursorKeyValues = [];

  constructor(private options: FirstFilterOptions<T>) {
    assertPositive(options.limit);

    if (options.after) {
      this.cursorKeyValues = translateCursorToKeyValues(options.after, {
        keys: options.cursorKeys,
      });
      this.offset =
        this.cursorKeyValues[this.cursorKeyValues.length - 1][1] ?? undefined;
    }
    this.edgeQuery = options.query;
  }

  private setPageMap(ret: T[], id: ID, hasNextPage: boolean) {
    this.pageMap.set(id, {
      hasNextPage,
      // hasPreviousPage always false even if there's a previous page because
      // we shouldn't be querying in both directions at the same
      hasPreviousPage: false,
      startCursor: this.edgeQuery.getCursor(ret[0]),
      endCursor: this.edgeQuery.getCursor(ret[ret.length - 1]),
    });
  }

  filter(id: ID, edges: T[]): T[] {
    if (edges.length > this.options.limit) {
      //  we need a way to know where the cursor is and if we used it and if not need to do this in TypeScript and not in SQL
      // so can't filter from 0 but specific item

      // if we used the query or we're querying the first N, slice from 0
      if (this.usedQuery || !this.offset) {
        const ret = edges.slice(0, this.options.limit);
        this.setPageMap(ret, id, true);
        return ret;
      } else if (this.offset) {
        const ret: T[] = [];
        let found = false;
        let i = 0;
        let hasNextPage = false;
        for (const edge of edges) {
          const id = edge[this.options.cursorCol];
          if (id === this.offset) {
            // found!
            found = true;
            hasNextPage = true;
            continue;
          }
          if (found) {
            ret.push(edge);
            if (ret.length === this.options.limit) {
              if (i === ret.length - 1) {
                hasNextPage = false;
              }
              break;
            }
          }
          i++;
        }
        if (hasNextPage && ret.length < this.options.limit) {
          hasNextPage = false;
        }
        if (ret.length) {
          this.setPageMap(ret, id, hasNextPage);
        }
        return ret;
      }
    }
    // TODO: in the future, when we have caching for edges
    // we'll want to hit that cache instead of passing the limit down to the
    // SQL query so we'll need a way to indicate whether this is done in SQL or not
    // and then the slice will always happen
    // so we'd need a way to indicate whether this is done in sql or not
    return edges;
  }

  async query(
    options: EdgeQueryableDataOptions,
  ): Promise<EdgeQueryableDataOptions> {
    this.usedQuery = true;

    // we fetch an extra one to see if we're at the end
    options.limit = this.options.limit + 1;

    const orderBy = this.options.orderby;

    if (this.offset) {
      const keyValuePairs: { [key: string]: string | number | null } = {};
      for (const [key, value] of this.cursorKeyValues) {
        keyValuePairs[key] = value;
      }
      options.clause = clause.AndOptional(
        options.clause,
        clause.PaginationUnboundColsQuery(
          orderBy.map((orderBy) => ({
            sortCol: orderBy.column,
            sortValue: keyValuePairs[orderBy.column],
            direction: orderBy.direction,
            nullsPlacement: orderBy.nullsPlacement,
            overrideAlias: orderBy.alias,
          })),
        ),
      );
    }

    options.orderby = orderBy;
    return options;
  }

  // TODO?
  paginationInfo(id: ID): PaginationInfo | undefined {
    return this.pageMap.get(id);
  }
}

// TODO LastFilter same behavior as FirstFilter
// TODO can we share so we don't keep needing to change in both
class LastFilter<T extends Data> implements EdgeQueryFilter<T> {
  /**
   * The offset is the value of the last key in the cursor, which is the primary key for the table
   */
  private offset: string | number | undefined;
  private pageMap: Map<ID, PaginationInfo> = new Map();
  private edgeQuery: BaseEdgeQuery<Ent, Ent, T>;
  private cursorKeyValues: CursorKeyValues = [];

  constructor(private options: LastFilterOptions<T>) {
    assertPositive(options.limit);

    if (options.before) {
      this.cursorKeyValues = translateCursorToKeyValues(options.before, {
        keys: options.cursorKeys,
      });
      this.offset =
        this.cursorKeyValues[this.cursorKeyValues.length - 1][1] ?? undefined;
    }
    this.edgeQuery = options.query;
  }

  filter(id: ID, edges: T[]): T[] {
    let ret: T[] = [];
    if (this.offset) {
      // we have an extra one, get rid of it. we only got it to see if hasPreviousPage = true
      if (edges.length > this.options.limit) {
        ret = edges.slice(0, edges.length - 1);
      } else {
        // done in SQL. nothing to do here.
        ret = edges;
      }
    } else {
      ret = edges.slice(0, this.options.limit);
    }

    if (edges.length > this.options.limit) {
      this.pageMap.set(id, {
        hasPreviousPage: true,
        // hasNextPage always false even if there's a next page because
        // we shouldn't be querying in both directions at the same
        hasNextPage: false,
        startCursor: this.edgeQuery.getCursor(ret[0]),
        endCursor: this.edgeQuery.getCursor(ret[ret.length - 1]),
      });
    }
    return ret;
  }

  async query(
    options: EdgeQueryableDataOptions,
  ): Promise<EdgeQueryableDataOptions> {
    // we fetch an extra one to see if we're at the end
    options.limit = this.options.limit + 1;

    // we also sort cursor col in same direction. (direction doesn't matter)
    const orderBy = reverseOrderBy(this.options.orderby);

    if (this.offset) {
      const keyValuePairs: { [key: string]: string | number | null } = {};
      for (const [key, value] of this.cursorKeyValues) {
        keyValuePairs[key] = value;
      }
      options.clause = clause.AndOptional(
        options.clause,
        clause.PaginationUnboundColsQuery(
          orderBy.map((orderBy) => ({
            sortCol: orderBy.column,
            sortValue: keyValuePairs[orderBy.column],
            direction: orderBy.direction,
            nullsPlacement: orderBy.nullsPlacement,
            overrideAlias: orderBy.alias,
          })),
        ),
      );
    }
    options.orderby = orderBy;

    return options;
  }

  paginationInfo(id: ID): PaginationInfo | undefined {
    return this.pageMap.get(id);
  }
}

export interface EdgeQueryOptions {
  cursorCol: string;
  cursorColIsDate?: boolean;
  orderby: OrderBy;
  joinBETA?: NonNullable<QueryableDataOptions["join"]>;
  // field options used to query field values
  fieldOptions?: SelectBaseDataOptions;
}

export abstract class BaseEdgeQuery<
  TSource extends Ent,
  TDest extends Ent,
  TEdge extends Data,
> implements EdgeQuery<TSource, TDest, TEdge>
{
  private filters: EdgeQueryFilter<TEdge>[] = [];
  private queryDispatched: boolean;
  protected edges: Map<ID, TEdge[]> = new Map();
  private pagination: Map<ID, PaginationInfo> = new Map();
  private memoizedloadEdges: () => Promise<Map<ID, TEdge[]>>;
  protected genIDInfosToFetch: () => Promise<IDInfo[]>;
  private idMap: Map<ID, TSource> = new Map();
  private idsToFetch: ID[] = [];

  // if the column we're sorting by is not unique e.g. created_at, we add a secondary sort column which is used in the cursor
  // to break ties and ensure that we can paginate correctly
  protected cursorCol: string;
  private edgeQueryOptions: EdgeQueryOptions;
  private limitAdded = false;
  private cursorKeys: string[] = [];

  constructor(
    public viewer: Viewer,
    options: EdgeQueryOptions,
  ) {
    // we also sort cursor col in same direction. (direction doesn't matter)
    const orderBy = [...options.orderby];
    if (
      !options.orderby.some((orderBy) => orderBy.column === options.cursorCol)
    ) {
      orderBy.push({
        column: options.cursorCol,
        direction: orderBy?.[0].direction || "DESC",
      });
    }
    orderBy.forEach((o) => {
      o.alias =
        o.alias ??
        (options.fieldOptions?.disableFieldsAlias
          ? undefined
          : (options.fieldOptions?.fieldsAlias ?? options.fieldOptions?.alias));
    });
    this.edgeQueryOptions = { ...options, orderby: orderBy };
    this.cursorCol = options.cursorCol;
    this.cursorKeys = orderBy.map((orderBy) => orderBy.column);

    this.memoizedloadEdges = memoize(this.loadEdges.bind(this));
    this.genIDInfosToFetch = memoize(this.genIDInfosToFetchImpl.bind(this));
  }

  protected getCursorCol(): string {
    return this.cursorCol;
  }

  getPrivacyPolicy() {
    // default PrivacyPolicy is always allow. nothing to do here
    return AlwaysAllowPrivacyPolicy;
  }

  abstract sourceEnt(id: ID): Promise<Ent | null>;

  first(n: number, after?: string): this {
    this.limitAdded = true;
    this.assertQueryNotDispatched("first");
    this.filters.push(
      new FirstFilter({
        limit: n,
        after,
        cursorCol: this.cursorCol,
        cursorKeys: this.cursorKeys,
        orderby: this.edgeQueryOptions.orderby,
        query: this,
        fieldOptions: this.edgeQueryOptions.fieldOptions,
      }),
    );
    return this;
  }

  // API subject to change
  // TODO https://github.com/lolopinto/ent/issues/685
  __addCustomFilterBETA(filter: EdgeQueryFilter<TEdge>) {
    this.filters.push(filter);
  }

  protected __assertNoFiltersBETA(name: string) {
    if (this.filters.length !== 0) {
      throw new Error(`${name} must be the first filter called`);
    }
  }

  last(n: number, before?: string): this {
    this.limitAdded = true;
    this.assertQueryNotDispatched("last");
    this.filters.push(
      new LastFilter({
        limit: n,
        before,
        cursorCol: this.cursorCol,
        cursorKeys: this.cursorKeys,
        orderby: this.edgeQueryOptions.orderby,
        query: this,
        fieldOptions: this.edgeQueryOptions.fieldOptions,
      }),
    );
    return this;
  }

  private async querySingleEdge(method: string): Promise<TEdge[]> {
    const edges = await this.memoizedloadEdges();
    if (edges.size !== 1) {
      throw new Error(
        `cannot call ${method} when more than one id is requested`,
      );
    }
    for (const [_, v] of edges) {
      return v;
    }
    throw new Error(`should be impossible to get here`);
  }

  // this is basically just raw rows
  readonly queryEdges = async (): Promise<TEdge[]> => {
    return this.querySingleEdge("queryEdges");
  };

  abstract queryRawCount(): Promise<number>;

  abstract queryAllRawCount(): Promise<Map<ID, number>>;

  readonly queryAllEdges = async (): Promise<Map<ID, TEdge[]>> => {
    return this.memoizedloadEdges();
  };

  abstract dataToID(edge: TEdge): ID;

  readonly queryIDs = async (): Promise<ID[]> => {
    const edges = await this.querySingleEdge("queryIDs");
    return edges.map((edge) => this.dataToID(edge));
  };

  readonly queryAllIDs = async (): Promise<Map<ID, ID[]>> => {
    const edges = await this.memoizedloadEdges();
    let results: Map<ID, ID[]> = new Map();
    for (const [id, edge_data] of edges) {
      results.set(
        id,
        edge_data.map((edge) => this.dataToID(edge)),
      );
    }
    return results;
  };

  readonly queryCount = async (): Promise<number> => {
    const edges = await this.querySingleEdge("queryCount");
    return edges.length;
  };

  readonly queryAllCount = async (): Promise<Map<ID, number>> => {
    let results: Map<ID, number> = new Map();
    const edges = await this.memoizedloadEdges();
    edges.forEach((list, id) => {
      results.set(id, list.length);
    });
    return results;
  };

  protected abstract loadEntsFromEdges(
    id: ID,
    edges: TEdge[],
  ): Promise<TDest[]>;

  readonly queryEnts = async (): Promise<TDest[]> => {
    const edges = await this.querySingleEdge("queryEnts");
    return this.loadEntsFromEdges("id", edges);
  };

  readonly queryAllEnts = async (): Promise<Map<ID, TDest[]>> => {
    // applies filters and then gets things after
    const edges = await this.memoizedloadEdges();
    let promises: Promise<void>[] = [];
    const results: Map<ID, TDest[]> = new Map();

    const loadEntsForID = async (id: ID, edges: TEdge[]) => {
      const ents = await this.loadEntsFromEdges(id, edges);
      results.set(id, ents);
    };
    for (const [id, edgesList] of edges) {
      promises.push(loadEntsForID(id, edgesList));
    }

    await Promise.all(promises);
    return results;
  };

  paginationInfo(): Map<ID, PaginationInfo> {
    this.assertQueryDispatched("paginationInfo");
    return this.pagination;
  }

  private assertQueryDispatched(str: string) {
    if (!this.queryDispatched) {
      throw new Error(`cannot call ${str} until query is dispatched`);
    }
  }

  private assertQueryNotDispatched(str: string) {
    if (this.queryDispatched) {
      throw new Error(`cannot call ${str} after query is dispatched`);
    }
  }

  // loadIDs, given an addID function which resolves ID or Ent dependening on what we have
  // if Ent, that's passed to privacy function
  // if ID and entForPrivacy() method, that's called with the id
  // if still no Ent (default/lots of cases), no ent is passed to applyPrivacyPolicy
  protected abstract loadRawIDs(
    addID: (src: ID | TSource) => void,
  ): Promise<void>;

  protected abstract loadRawData(
    infos: IDInfo[],
    options: EdgeQueryableDataOptions,
  ): Promise<void>;

  private addID(id: ID | TSource) {
    if (typeof id === "object") {
      this.idMap.set(id.id, id);
      this.idsToFetch.push(id.id);
    } else {
      this.idsToFetch.push(id);
    }
  }

  abstract getTableName(): string | Promise<string>;

  protected async genIDInfosToFetchImpl() {
    await this.loadRawIDs(this.addID.bind(this));

    return applyPrivacyPolicyForEdgeQ(
      this.viewer,
      this,
      this.idsToFetch,
      this.idMap,
    );
  }

  private _defaultEdgeQueryableOptions: EdgeQueryableDataOptions | undefined;

  // FYI: this should be used sparingly.
  // currently only exists so that disableTransformations can be configured by the developer
  // so we're only exposing a partial API for now but maybe in the future we can expose
  // the full API if there's a reason to use this that's not via filters
  protected configureEdgeQueryableDataOptions(
    opts: EdgeQueryableDataOptionsConfigureLoader,
  ) {
    this._defaultEdgeQueryableOptions = opts;
  }

  protected getDefaultEdgeQueryOptions() {
    return this._defaultEdgeQueryableOptions;
  }

  private async loadEdges(): Promise<Map<ID, TEdge[]>> {
    const idsInfo = await this.genIDInfosToFetch();

    // we need first even if other filters are included...
    if (!this.limitAdded) {
      // if no limit filter, we add the firstN filter to ensure we get pagination info
      this.first(getDefaultLimit());
    }

    let options: EdgeQueryableDataOptions =
      this._defaultEdgeQueryableOptions ?? {};

    // TODO once we add a lot of complex filters, this needs to be more complicated
    // e.g. commutative filters. what can be done in sql or combined together etc
    // may need to bring sql mode or something back
    for (const filter of this.filters) {
      if (filter.query) {
        if (filter.fetch) {
          throw new Error(
            `a filter that augments the query cannot currently fetch`,
          );
        }
        let res = filter.query(options);
        options = isPromise(res) ? await res : res;
      } else {
        // if we've seen a filter that doesn't have a query, we can't do anything in SQL
        // TODO figure out filter interactions https://github.com/lolopinto/ent/issues/685

        // this is a scenario where if we have the first N filters that can modify the query,
        // we do that in SQL and then we do the rest in code
        // but once we have something doing it in code (e.g. intersect()), we can't do anything else in SQL

        // and then have to differentiate between filters that augment (limit or add to) the items returned
        // and those that reorder...
        break;
      }
    }

    await this.loadRawData(idsInfo, options);

    // no filters. nothing to do here.
    if (!this.filters.length) {
      return this.edges;
    }

    // fetch anything we need to filter the query
    for await (const filter of this.filters) {
      if (filter.fetch) {
        await filter.fetch();
      }
    }

    // filter as needed
    for (let [id, edges] of this.edges) {
      this.filters.forEach((filter) => {
        if (filter.filter) {
          edges = filter.filter(id, edges);
        }
        if (filter.paginationInfo) {
          const pagination = filter.paginationInfo(id);
          if (pagination) {
            this.pagination.set(id, pagination);
          }
        }
      });
      this.edges.set(id, edges);
    }

    this.queryDispatched = true;

    return this.edges;
  }

  getCursor(row: TEdge): string {
    return getCursor({
      row,
      cursorKeys: this.cursorKeys,
    });
  }
}

export interface IDInfo {
  id: ID;
  // if invalidated (usually for privacy), don't fetch data for it, feel free to store the 0-value e.g. 0, [], for the result
  // may eventually be null instead
  invalidated?: boolean;
}

async function applyPrivacyPolicyForEdgeQ<
  TSource extends Ent,
  TDest extends Ent,
  TEdge extends Data,
>(
  viewer: Viewer,
  edgeQ: EdgeQuery<TSource, TDest, TEdge>,
  ids: ID[],
  map: Map<ID, TSource>,
): Promise<IDInfo[]> {
  const result: IDInfo[] = [];

  await Promise.all(
    ids.map(async (id) => {
      let ent: Ent | null | undefined = map.get(id);
      if (!ent) {
        ent = await edgeQ.sourceEnt(id);
      }
      const r = await applyPrivacyPolicy(
        viewer,
        edgeQ.getPrivacyPolicy(),
        ent || undefined,
      );
      result.push({
        id,
        invalidated: !r,
      });
    }),
  );
  return result;
}
