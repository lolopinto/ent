import {
  ID,
  Ent,
  Viewer,
  EdgeQueryableDataOptions,
  Data,
  PrivacyPolicy,
} from "../base";
import { DefaultLimit, getCursor } from "../ent";
import * as clause from "../clause";
import memoize from "memoizee";
import { AlwaysAllowPrivacyPolicy, applyPrivacyPolicy } from "../privacy";

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
  // this is a filter that does the processing in TypeScript instead of at the SQL layer
  filter?(id: ID, edges: T[]): T[];

  // there's 2 ways to do it.
  // apply it in SQL
  // or process it after the fact
  query?(options: EdgeQueryableDataOptions): EdgeQueryableDataOptions;
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

function assertValidCursor(cursor: string, col: string): number {
  let decoded = Buffer.from(cursor, "base64").toString("ascii");
  let parts = decoded.split(":");
  // invalid or unknown cursor. nothing to do here.
  if (parts.length !== 2 || parts[0] !== col) {
    throw new Error(`invalid cursor ${cursor} passed`);
  }
  // TODO check if numeric or not but for now we're only doing numbers
  const time = parseInt(parts[1], 10);
  if (isNaN(time)) {
    throw new Error(`invalid cursor ${cursor} passed`);
  }
  return time;
}

interface FilterOptions {
  limit: number;
  query: BaseEdgeQuery<Ent, Ent, Data>;
  before?: string;
  after?: string;
  sortCol?: string; // what column are we sorting by. defaults to `time`
  // if sortCol is provided, check if time or not
  sortColNotTime?: boolean;
}

class FirstFilter<T extends Data> implements EdgeQueryFilter<T> {
  private offset: any | undefined;
  private sortCol: string;
  private edgeQuery: BaseEdgeQuery<Ent, Ent, Data>;
  private pageMap: Map<ID, PaginationInfo> = new Map();

  constructor(private options: FilterOptions) {
    assertPositive(options.limit);

    if (options.before) {
      throw new Error(`cannot specify before with a first filter`);
    }
    this.sortCol = options.sortCol || "time";
    if (options.after) {
      this.offset = assertValidCursor(options.after, this.sortCol);
    }
    if (this.options.sortColNotTime && !this.options.sortCol) {
      throw new Error(
        `cannot specify sortColNotTime without specifying a sortCol`,
      );
    }
    this.edgeQuery = options.query;
  }

  filter(id: ID, edges: T[]): T[] {
    if (edges.length > this.options.limit) {
      const ret = edges.slice(0, this.options.limit);
      this.pageMap.set(id, {
        hasNextPage: true,
        hasPreviousPage: false,
        startCursor: this.edgeQuery.getCursor(ret[0]),
        endCursor: this.edgeQuery.getCursor(ret[ret.length - 1]),
      });
      return ret;
    }
    // TODO: in the future, when we have caching for edges
    // we'll want to hit that cache instead of passing the limit down to the
    // SQL query so we'll need a way to indicate whether this is done in SQL or not
    // and then the slice will always happen
    // so we'd need a way to indicate whether this is done in sql or not
    return edges;
  }

  query(options: EdgeQueryableDataOptions): EdgeQueryableDataOptions {
    // we fetch an extra one to see if we're at the end
    const limit = this.options.limit + 1;

    options.limit = limit;
    // todo may not be desc
    // and if asc
    // clause below should switch to greater...
    options.orderby = `${this.sortCol} DESC`;
    // we sort by most recent first
    // so when paging, we fetch afterCursor X
    if (this.offset) {
      if (this.options.sortColNotTime) {
        options.clause = clause.Less(this.sortCol, this.offset);
      } else {
        options.clause = clause.Less(
          this.sortCol,
          new Date(this.offset).toISOString(),
        );
      }
    }
    return options;
  }

  // TODO?
  paginationInfo(id: ID): PaginationInfo | undefined {
    return this.pageMap.get(id);
  }
}

class LastFilter<T extends Data> implements EdgeQueryFilter<T> {
  private offset: any | undefined;
  private sortCol: string;
  private pageMap: Map<ID, PaginationInfo> = new Map();
  private edgeQuery: BaseEdgeQuery<Ent, Ent, Data>;

  constructor(private options: FilterOptions) {
    assertPositive(options.limit);

    if (options.after) {
      throw new Error(`cannot specify after with a last filter`);
    }
    this.sortCol = options.sortCol || "time";
    if (options.before) {
      this.offset = assertValidCursor(options.before, this.sortCol);
    }
    if (this.options.sortColNotTime && !this.options.sortCol) {
      throw new Error(
        `cannot specify sortColNotTime without specifying a sortCol`,
      );
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
      ret = edges.slice(edges.length - this.options.limit, edges.length);
    }

    if (edges.length > this.options.limit) {
      this.pageMap.set(id, {
        hasPreviousPage: true,
        hasNextPage: false,
        startCursor: this.edgeQuery.getCursor(ret[0]),
        endCursor: this.edgeQuery.getCursor(ret[ret.length - 1]),
      });
    }
    return ret;
  }

  query(options: EdgeQueryableDataOptions): EdgeQueryableDataOptions {
    if (!this.offset) {
      return options;
    }

    options.orderby = `${this.sortCol} ASC`;
    options.limit = this.options.limit + 1; // fetch an extra so we know if previous pag

    if (this.options.sortColNotTime) {
      options.clause = clause.Greater(this.sortCol, this.offset);
    } else {
      options.clause = clause.Greater(
        this.sortCol,
        new Date(this.offset).toISOString(),
      );
    }
    return options;
  }

  paginationInfo(id: ID): PaginationInfo | undefined {
    return this.pageMap.get(id);
  }
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

  constructor(public viewer: Viewer, private sortCol: string) {
    this.memoizedloadEdges = memoize(this.loadEdges.bind(this));
    this.genIDInfosToFetch = memoize(this.genIDInfosToFetchImpl.bind(this));
  }

  getPrivacyPolicy() {
    // default PrivacyPolicy is always allow. nothing to do here
    return AlwaysAllowPrivacyPolicy;
  }

  abstract sourceEnt(id: ID): Promise<Ent | null>;

  first(n: number, after?: string): this {
    this.assertQueryNotDispatched("first");
    this.filters.push(
      new FirstFilter({
        limit: n,
        after,
        sortCol: this.sortCol,
        query: this,
      }),
    );
    return this;
  }

  last(n: number, before?: string): this {
    this.assertQueryNotDispatched("last");
    this.filters.push(
      new LastFilter({
        limit: n,
        before,
        sortCol: this.sortCol,
        query: this,
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
    return await this.querySingleEdge("queryEdges");
  };

  abstract queryRawCount(): Promise<number>;

  abstract queryAllRawCount(): Promise<Map<ID, number>>;

  readonly queryAllEdges = async (): Promise<Map<ID, TEdge[]>> => {
    return await this.memoizedloadEdges();
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
    return await this.loadEntsFromEdges("id", edges);
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

  protected async genIDInfosToFetchImpl() {
    await this.loadRawIDs(this.addID.bind(this));

    return applyPrivacyPolicyForEdgeQ(
      this.viewer,
      this,
      this.idsToFetch,
      this.idMap,
    );
  }

  private async loadEdges(): Promise<Map<ID, TEdge[]>> {
    const idsInfo = await this.genIDInfosToFetch();

    if (!this.filters.length) {
      // if no filter, we add the firstN filter to ensure we get pagination info
      this.first(DefaultLimit);
    }

    let options: EdgeQueryableDataOptions = {};
    // TODO once we add a lot of complex filters, this needs to be more complicated
    // e.g. commutative filters. what can be done in sql or combined together etc
    // may need to bring sql mode or something back
    this.filters.forEach((filter) => {
      if (filter.query) {
        options = filter.query(options);
      }
    });

    await this.loadRawData(idsInfo, options);

    // no filters. nothing to do here.
    if (!this.filters.length) {
      return this.edges;
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
      col: this.sortCol,
      conv: (datum) => {
        if (datum instanceof Date) {
          return datum.getTime();
        }
        // sqlite stores it as string and doesn't convert back
        if (typeof datum === "string") {
          return Date.parse(datum);
        }
        return datum;
      },
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
