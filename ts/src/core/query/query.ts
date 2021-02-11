import {
  ID,
  Ent,
  Viewer,
  EdgeQueryableDataOptions,
  DefaultLimit,
  Data,
} from "../ent";
import * as clause from "../clause";

export interface EdgeQuery<T extends Ent, TEdge extends Data> {
  queryEdges(): Promise<Map<ID, TEdge[]>>;
  queryIDs(): Promise<Map<ID, ID[]>>;
  queryCount(): Promise<Map<ID, number>>;
  queryRawCount(): Promise<Map<ID, number>>;
  queryEnts(): Promise<Map<ID, T[]>>;

  first(n: number, after?: string): EdgeQuery<T, TEdge>;
  last(n: number, before?: string): EdgeQuery<T, TEdge>;
  paginationInfo(): Map<ID, PaginationInfo>;
  getCursor(row: TEdge): string;
  dataToID(edge: TEdge): ID;
}

interface EdgeQueryFilter<T extends Data> {
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
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
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

export interface FilterOptions {
  limit: number;
  before?: string;
  after?: string;
  sortCol?: string; // what column are we sorting by. defaults to `time`
  // if sortCol is provided, check if time or not
  sortColNotTime?: boolean;
}

class FirstFilter<T extends Data> implements EdgeQueryFilter<T> {
  private offset: any | undefined;
  private sortCol: string;
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
  }

  filter(id: ID, edges: T[]): T[] {
    if (edges.length > this.options.limit) {
      this.pageMap.set(id, { hasNextPage: true });
      return edges.slice(0, this.options.limit);
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
    options.orderby = `${this.sortCol} DESC`;
    // we sort by most recent first
    // so when paging, we fetch afterCursor X
    if (this.offset) {
      if (this.options.sortColNotTime) {
        options.clause = clause.Less(this.sortCol, this.offset);
      }
      options.clause = clause.Less(
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

class LastFilter<T extends Data> implements EdgeQueryFilter<T> {
  private offset: any | undefined;
  private sortCol: string;
  private pageMap: Map<ID, PaginationInfo> = new Map();

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
  }

  filter(id: ID, edges: T[]): T[] {
    if (edges.length > this.options.limit) {
      this.pageMap.set(id, { hasPreviousPage: true });
    }
    if (this.offset) {
      // we have an extra one, get rid of it. we only got it to see if hasPreviousPage = true
      if (edges.length > this.options.limit) {
        return edges.slice(0, edges.length - 1);
      }
      // done in SQL. nothing to do here.
      return edges;
    }
    return edges.slice(edges.length - this.options.limit, edges.length);
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

export abstract class BaseEdgeQuery<TDest extends Ent, TEdge extends Data> {
  private filters: EdgeQueryFilter<TEdge>[] = [];
  private queryDispatched: boolean;
  protected edges: Map<ID, TEdge[]> = new Map();
  private pagination: Map<ID, PaginationInfo> = new Map();

  constructor(public viewer: Viewer, private sortCol: string) {}

  first(n: number, after?: string): this {
    this.assertQueryNotDispatched("first");
    this.filters.push(
      new FirstFilter({ limit: n, after, sortCol: this.sortCol }),
    );
    return this;
  }

  last(n: number, before?: string): this {
    this.assertQueryNotDispatched("last");
    this.filters.push(
      new LastFilter({ limit: n, before, sortCol: this.sortCol }),
    );
    return this;
  }

  // this is basically just raw rows
  readonly queryEdges = async (): Promise<Map<ID, TEdge[]>> => {
    return await this.loadEdges();
  };

  abstract dataToID(edge: TEdge): ID;

  readonly queryIDs = async (): Promise<Map<ID, ID[]>> => {
    const edges = await this.loadEdges();
    let results: Map<ID, ID[]> = new Map();
    for (const [id, edge_data] of edges) {
      results.set(
        id,
        edge_data.map((edge) => this.dataToID(edge)),
      );
    }
    return results;
  };

  readonly queryCount = async (): Promise<Map<ID, number>> => {
    let results: Map<ID, number> = new Map();
    const edges = await this.loadEdges();
    edges.forEach((list, id) => {
      results.set(id, list.length);
    });
    return results;
  };

  protected abstract loadEntsFromEdges(
    id: ID,
    edges: TEdge[],
  ): Promise<TDest[]>;

  readonly queryEnts = async (): Promise<Map<ID, TDest[]>> => {
    // applies filters and then gets things after
    const edges = await this.loadEdges();
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

  protected abstract loadRawData(
    options: EdgeQueryableDataOptions,
  ): Promise<void>;

  private async loadEdges() {
    if (this.queryDispatched) {
      return this.edges;
    }

    // if no filter, we add the firstN filter to ensure we get pagination info
    if (!this.filters.length) {
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

    await this.loadRawData(options);

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
    // TODO how does one memoize this call?
    this.queryDispatched = true;

    return this.edges;
  }

  getCursor(row: TEdge): string {
    let datum = row[this.sortCol];
    if (!datum) {
      return "";
    }
    if (datum instanceof Date) {
      datum = datum.getTime();
    }
    const str = `${this.sortCol}:${datum}`;
    return Buffer.from(str, "ascii").toString("base64");
  }
}
