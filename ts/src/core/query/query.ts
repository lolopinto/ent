import {
  ID,
  Ent,
  Viewer,
  EdgeQueryableDataOptions,
  Data,
  PrivacyPolicy,
} from "../base";
import { getDefaultLimit, getCursor } from "../ent";
import * as clause from "../clause";
import memoize from "memoizee";
import { AlwaysAllowPrivacyPolicy, applyPrivacyPolicy } from "../privacy";
import { validate } from "uuid";
import { types } from "util";

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

function assertValidCursor(cursor: string, col: string): any {
  let decoded = Buffer.from(cursor, "base64").toString("ascii");
  let parts = decoded.split(":");
  // uuid, don't parse int since it tries to validate just first part
  if (validate(parts[1])) {
    return parts[1];
  }
  // invalid or unknown cursor. nothing to do here.
  if (parts.length !== 2 || parts[0] !== col) {
    throw new Error(`invalid cursor ${cursor} passed`);
  }
  // TODO handle both cases... (time vs not) better
  // TODO change this to only do the parseInt part if time...
  // pass flag indicating if time?
  const time = parseInt(parts[1], 10);
  if (isNaN(time)) {
    return parts[1];
  }
  return time;
}

interface FilterOptions<T extends Data> {
  limit: number;
  query: BaseEdgeQuery<Ent, Ent, T>;
  sortCol: string;
  cursorCol: string;
  defaultDirection?: "ASC" | "DESC";
  // TODO provide this option
  // if sortCol is Unique and time, we need to pass different values for comparisons and checks...
  sortColTime?: boolean;

  // indicates that sort column is unique and we shouldn't use the id from the
  // table as the cursor and use the sort column instead
  sortColumnUnique?: boolean;

  nullsPlacement?: "first" | "last";
}

interface FirstFilterOptions<T extends Data> extends FilterOptions<T> {
  after?: string;
}

interface LastFilterOptions<T extends Data> extends FilterOptions<T> {
  before?: string;
}

const orderbyRegex = new RegExp(/([0-9a-z_]+)[ ]?([0-9a-z_]+)?/i);

class FirstFilter<T extends Data> implements EdgeQueryFilter<T> {
  private offset: any | undefined;
  private sortCol: string;
  private edgeQuery: BaseEdgeQuery<Ent, Ent, T>;
  private pageMap: Map<ID, PaginationInfo> = new Map();

  constructor(private options: FirstFilterOptions<T>) {
    assertPositive(options.limit);

    this.sortCol = options.sortCol;
    if (options.after) {
      this.offset = assertValidCursor(options.after, options.cursorCol);
    }
    this.edgeQuery = options.query;
  }

  filter(id: ID, edges: T[]): T[] {
    if (edges.length > this.options.limit) {
      const ret = edges.slice(0, this.options.limit);
      this.pageMap.set(id, {
        hasNextPage: true,
        // hasPreviousPage always false even if there's a previous page because
        // we shouldn't be querying in both directions at the same
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

  async query(
    options: EdgeQueryableDataOptions,
  ): Promise<EdgeQueryableDataOptions> {
    // we fetch an extra one to see if we're at the end
    const limit = this.options.limit + 1;

    options.limit = limit;

    let orderby = this.options.defaultDirection || "DESC";

    // we sort by most recent first
    // so when paging, we fetch afterCursor X
    const less = orderby === "DESC";

    let nullsPlacement = "";
    if (this.options.nullsPlacement) {
      if (this.options.nullsPlacement === "first") {
        nullsPlacement = " NULLS FIRST";
      } else {
        nullsPlacement = " NULLS LAST";
      }
    }

    if (this.options.cursorCol !== this.sortCol) {
      // we also sort unique col in same direction since it doesn't matter...
      // nulls placement only affects sortCol. assumption is cursorCol will not be null and no need for that
      options.orderby = `${this.sortCol} ${orderby}${nullsPlacement}, ${this.options.cursorCol} ${orderby}`;

      if (this.offset) {
        const res = this.edgeQuery.getTableName();
        const tableName = types.isPromise(res) ? await res : res;
        // inner col time
        options.clause = clause.PaginationMultipleColsSubQuery(
          this.sortCol,
          less ? "<" : ">",
          tableName,
          this.options.cursorCol,
          this.offset,
        );
      }
    } else {
      options.orderby = `${this.sortCol} ${orderby}${nullsPlacement}`;

      if (this.offset) {
        let clauseFn = less ? clause.Less : clause.Greater;
        let val = this.options.sortColTime
          ? new Date(this.offset).toISOString()
          : this.offset;
        options.clause = clauseFn(this.sortCol, val);
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
  private edgeQuery: BaseEdgeQuery<Ent, Ent, T>;

  constructor(private options: LastFilterOptions<T>) {
    assertPositive(options.limit);

    this.sortCol = options.sortCol;
    if (options.before) {
      this.offset = assertValidCursor(options.before, options.cursorCol);
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
    // assume desc by default
    // so last is reverse
    let orderby = "ASC";
    if (this.options.defaultDirection) {
      // reverse sort col shown...
      if (this.options.defaultDirection === "DESC") {
        orderby = "ASC";
      } else {
        orderby = "DESC";
      }
    }

    const greater = orderby === "ASC";

    options.limit = this.options.limit + 1; // fetch an extra so we know if previous pag

    if (this.options.cursorCol !== this.sortCol) {
      const res = this.edgeQuery.getTableName();
      const tableName = types.isPromise(res) ? await res : res;

      if (this.offset) {
        // inner col time
        options.clause = clause.PaginationMultipleColsSubQuery(
          this.sortCol,
          greater ? ">" : "<",
          tableName,
          this.options.cursorCol,
          this.offset,
        );
      }
      options.orderby = `${this.sortCol} ${orderby}, ${this.options.cursorCol} ${orderby}`;
    } else {
      options.orderby = `${this.sortCol} ${orderby}`;

      if (this.offset) {
        let clauseFn = greater ? clause.Greater : clause.Less;
        let val = this.options.sortColTime
          ? new Date(this.offset).toISOString()
          : this.offset;
        options.clause = clauseFn(this.sortCol, val);
      }
    }

    return options;
  }

  paginationInfo(id: ID): PaginationInfo | undefined {
    return this.pageMap.get(id);
  }
}

interface EdgeQueryOptions {
  cursorCol: string;
  sortCol: string;
  nullsPlacement?: "first" | "last";
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
  private sortCol: string;
  private cursorCol: string;
  private defaultDirection?: "ASC" | "DESC";
  private edgeQueryOptions: EdgeQueryOptions;

  constructor(viewer: Viewer, sortCol: string, cursorCol: string);
  constructor(viewer: Viewer, options: EdgeQueryOptions);

  constructor(
    public viewer: Viewer,
    sortColOrOptions: any,
    cursorColMaybe?: string,
  ) {
    let sortCol: string;
    let cursorCol: string;
    if (typeof sortColOrOptions === "string") {
      sortCol = sortColOrOptions;
      cursorCol = cursorColMaybe!;
      this.edgeQueryOptions = {
        cursorCol,
        sortCol,
      };
    } else {
      sortCol = sortColOrOptions.sortCol;
      cursorCol = sortColOrOptions.cursorCol;
      this.edgeQueryOptions = sortColOrOptions;
    }
    let m = orderbyRegex.exec(sortCol);
    if (!m) {
      throw new Error(`invalid sort column ${sortCol}`);
    }
    this.sortCol = m[1];
    if (m[2]) {
      // @ts-ignore
      this.defaultDirection = m[2].toUpperCase();
    }

    let m2 = orderbyRegex.exec(cursorCol);
    if (!m2) {
      throw new Error(`invalid sort column ${cursorCol}`);
    }
    this.cursorCol = m2[1];
    this.memoizedloadEdges = memoize(this.loadEdges.bind(this));
    this.genIDInfosToFetch = memoize(this.genIDInfosToFetchImpl.bind(this));
  }

  protected getSortCol(): string {
    return this.sortCol;
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
        cursorCol: this.cursorCol,
        defaultDirection: this.defaultDirection,
        nullsPlacement: this.edgeQueryOptions.nullsPlacement,
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
        cursorCol: this.cursorCol,
        defaultDirection: this.defaultDirection,
        nullsPlacement: this.edgeQueryOptions.nullsPlacement,
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
    opts: Pick<EdgeQueryableDataOptions, "disableTransformations">,
  ) {
    this._defaultEdgeQueryableOptions = opts;
  }

  protected getDefaultEdgeQueryOptions() {
    return this._defaultEdgeQueryableOptions;
  }

  private async loadEdges(): Promise<Map<ID, TEdge[]>> {
    const idsInfo = await this.genIDInfosToFetch();

    if (!this.filters.length) {
      // if no filter, we add the firstN filter to ensure we get pagination info
      this.first(getDefaultLimit());
    }

    let options: EdgeQueryableDataOptions =
      this._defaultEdgeQueryableOptions ?? {};

    // TODO once we add a lot of complex filters, this needs to be more complicated
    // e.g. commutative filters. what can be done in sql or combined together etc
    // may need to bring sql mode or something back
    for (const filter of this.filters) {
      if (filter.query) {
        let res = filter.query(options);
        options = types.isPromise(res) ? await res : res;
      }
    }

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
      col: this.cursorCol,
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
