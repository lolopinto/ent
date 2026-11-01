import { isPromise } from "util/types";
import {
  Data,
  EdgeQueryableDataOptions,
  EdgeQueryableDataOptionsConfigureLoader,
  Ent,
  ID,
  PrivacyPolicy,
  Viewer,
} from "../base";
import { getDefaultLimit } from "../ent";
import { AlwaysAllowPrivacyPolicy, applyPrivacyPolicy } from "../privacy";
import { memoizeNoArgs } from "../memoize";
import {
  emptyPaginationInfo,
  PaginationInfo,
  QueryPagination,
  QueryPaginationOptions,
  RowQueryFilter,
} from "./pagination";

export interface ConnectionQuery<TDest extends Ent, TEdge extends Data> {
  queryEdges(): Promise<TEdge[]>;
  queryEnts(): Promise<TDest[]>;
  queryIDs(): Promise<ID[]>;
  queryCount(): Promise<number>;
  queryRawCount(): Promise<number>;
  first(n: number, after?: string): ConnectionQuery<TDest, TEdge>;
  last(n: number, before?: string): ConnectionQuery<TDest, TEdge>;
  queryPageInfo(): Promise<PaginationInfo>;
  getCursor(row: TEdge): string;
  dataToID(edge: TEdge): ID;
}

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
  // Optional for existing third-party implementations of EdgeQuery.
  queryPageInfo?(): Promise<PaginationInfo>;
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

export type { PaginationInfo, CursorKeyValues } from "./pagination";
export type EdgeQueryOptions = QueryPaginationOptions;

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
  private cursorPagination: QueryPagination<TEdge>;
  private limitAdded = false;

  constructor(
    public viewer: Viewer,
    options: EdgeQueryOptions,
  ) {
    this.cursorPagination = new QueryPagination(options, (row) =>
      this.getCursor(row),
    );
    this.cursorCol = options.cursorCol;

    this.memoizedloadEdges = memoizeNoArgs(this.loadEdges.bind(this));
    this.genIDInfosToFetch = memoizeNoArgs(
      this.genIDInfosToFetchImpl.bind(this),
    );
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
    this.addPaginationFilter(this.cursorPagination.first(n, after));
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
    this.addPaginationFilter(this.cursorPagination.last(n, before));
    return this;
  }

  private addPaginationFilter(filter: RowQueryFilter<TEdge>) {
    this.filters.push({
      query: filter.query?.bind(filter),
      filter: (id, edges) => {
        const rows = filter.filter ? filter.filter(edges) : edges;
        const pageInfo = filter.paginationInfo?.();
        if (pageInfo) {
          this.pagination.set(id, pageInfo);
        }
        return rows;
      },
    });
  }

  async queryPageInfo(): Promise<PaginationInfo> {
    await this.querySingleEdge("queryPageInfo");
    const [id] = this.edges.keys();
    return this.pagination.get(id) ?? emptyPaginationInfo();
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
    return this.cursorPagination.getCursor(row);
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
