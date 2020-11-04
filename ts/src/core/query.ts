//import { Edge } from "src/schema";

import {
  ID,
  AssocEdge,
  Ent,
  Viewer,
  loadEdges,
  loadRawEdgeCountX,
  LoadEntOptions,
  loadEnts,
  EdgeQueryableDataOptions,
  DefaultLimit,
} from "./ent";
import * as clause from "./clause";

export interface EdgeQuery<T extends Ent> {
  queryEdges(): Promise<Map<ID, AssocEdge[]>>;
  queryIDs(): Promise<Map<ID, ID[]>>;
  queryCount(): Promise<Map<ID, number>>;
  queryRawCount(): Promise<Map<ID, number>>;
  queryEnts(): Promise<Map<ID, T[]>>;

  first(n: number, after?: string): EdgeQuery<T>;
  last(n: number, before?: string): EdgeQuery<T>;
  paginationInfo(): Map<ID, PaginationInfo>;

  // TODO we need a way to handle singular id for e.g. unique edge
}

interface EdgeQueryFilter {
  // this is a filter that does the processing in TypeScript instead of at the SQL layer
  filter?(id: ID, edges: AssocEdge[]): AssocEdge[];

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

interface PaginationInfo {
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

function assertPositive(n: number) {
  if (n < 0) {
    throw new Error("cannot use a negative number");
  }
}

function assertValidCursor(cursor: string): number {
  let decoded = Buffer.from(cursor, "base64").toString("ascii");
  let parts = decoded.split(":");
  // invalid or unknown cursor. nothing to do here.
  if (parts.length !== 2 || parts[0] !== "time") {
    throw new Error(`invalid cursor ${cursor} passed`);
  }
  const time = parseInt(parts[1], 10);
  if (isNaN(time)) {
    throw new Error(`invalid cursor ${cursor} passed`);
  }
  return time;
}

class FirstFilter implements EdgeQueryFilter {
  private time: number | undefined;
  private pageMap: Map<ID, PaginationInfo> = new Map();

  constructor(private limit: number, after?: string) {
    assertPositive(limit);
    if (after) {
      this.time = assertValidCursor(after);
    }
  }

  filter(id: ID, edges: AssocEdge[]): AssocEdge[] {
    if (edges.length > this.limit) {
      this.pageMap.set(id, { hasNextPage: true });
      return edges.slice(0, this.limit);
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
    const limit = this.limit + 1;

    options.limit = limit;
    // we sort by most recent first
    // so when paging, we fetch afterCursor X
    if (this.time) {
      options.clause = clause.Less("time", new Date(this.time));
      // just to be explicit even though this is the default
      options.orderby = "time DESC";
    }
    return options;
  }

  paginationInfo(id: ID): PaginationInfo | undefined {
    return this.pageMap.get(id);
  }
}

class LastFilter implements EdgeQueryFilter {
  private time: number | undefined;
  private pageMap: Map<ID, PaginationInfo> = new Map();

  constructor(private limit: number, after?: string) {
    assertPositive(limit);
    if (after) {
      this.time = assertValidCursor(after);
    }
  }

  filter(id: ID, edges: AssocEdge[]): AssocEdge[] {
    if (edges.length > this.limit) {
      this.pageMap.set(id, { hasPreviousPage: true });
    }
    if (this.time) {
      // we have an extra one, get rid of it. we only got it to see if hasPreviousPage = true
      if (edges.length > this.limit) {
        return edges.slice(0, edges.length - 1);
      }
      // done in SQL. nothing to do here.
      return edges;
    }
    return edges.slice(edges.length - this.limit, edges.length);
  }

  query(options: EdgeQueryableDataOptions): EdgeQueryableDataOptions {
    if (!this.time) {
      return options;
    }

    // we sort by most recent first
    // so when paging backwards, we fetch beforeCursor X
    return {
      ...options,
      clause: clause.Greater("time", new Date(this.time)),
      orderby: "time ASC",
      limit: this.limit + 1, // fetch an extra so we know if previous page
    };
  }

  paginationInfo(id: ID): PaginationInfo | undefined {
    return this.pageMap.get(id);
  }
}

export type EdgeQuerySource<T extends Ent> = T | T[] | ID | ID[] | EdgeQuery<T>;

export class BaseEdgeQuery<TSource extends Ent, TDest extends Ent> {
  private filters: EdgeQueryFilter[] = [];
  private queryDispatched: boolean;
  private idsResolved: boolean;
  private edges: Map<ID, AssocEdge[]> = new Map();
  private resolvedIDs: ID[] = [];
  private pagination: Map<ID, PaginationInfo> = new Map();

  constructor(
    public viewer: Viewer,
    public src: EdgeQuerySource<TSource>,
    private edgeType: string,
    private ctr: LoadEntOptions<TDest>,
  ) {}

  // TODO memoization...
  private async resolveIDs(): Promise<ID[]> {
    if (this.idsResolved) {
      return this.resolvedIDs;
    }
    if (Array.isArray(this.src)) {
      this.src.forEach((obj: TSource | ID) => this.addID(obj));
    } else if (this.isEdgeQuery(this.src)) {
      const idsMap = await this.src.queryIDs();
      for (const [_, ids] of idsMap) {
        ids.forEach((id) => this.resolvedIDs.push(id));
      }
    } else {
      this.addID(this.src);
    }
    this.idsResolved = true;
    return this.resolvedIDs;
  }

  private isEdgeQuery(
    obj: TSource | ID | EdgeQuery<TSource>,
  ): obj is EdgeQuery<TSource> {
    if ((obj as EdgeQuery<TSource>).queryIDs !== undefined) {
      return true;
    }
    return false;
  }

  private addID(obj: TSource | ID) {
    if (typeof obj === "object") {
      this.resolvedIDs.push(obj.id);
    } else {
      this.resolvedIDs.push(obj);
    }
  }

  first(n: number, after?: string): this {
    this.assertQueryNotDispatched("first");
    this.filters.push(new FirstFilter(n, after));
    return this;
  }

  last(n: number, before?: string): this {
    this.assertQueryNotDispatched("last");
    this.filters.push(new LastFilter(n, before));
    return this;
  }

  async queryEdges(): Promise<Map<ID, AssocEdge[]>> {
    return await this.loadEdges();
  }

  async queryIDs(): Promise<Map<ID, ID[]>> {
    const edges = await this.loadEdges();
    let results: Map<ID, ID[]> = new Map();
    for (const [id, edge_data] of edges) {
      results.set(
        id,
        edge_data.map((edge) => edge.id2),
      );
    }
    return results;
  }

  // doesn't work with filters...
  async queryRawCount(): Promise<Map<ID, number>> {
    let results: Map<ID, number> = new Map();
    const ids = await this.resolveIDs();
    await Promise.all(
      ids.map(async (id) => {
        const count = await loadRawEdgeCountX({
          id1: id,
          edgeType: this.edgeType,
          context: this.viewer.context,
        });
        results.set(id, count);
      }),
    );
    return results;
  }

  // works with filters
  async queryCount(): Promise<Map<ID, number>> {
    let results: Map<ID, number> = new Map();
    const edges = await this.loadEdges();
    edges.forEach((list, id) => {
      results.set(id, list.length);
    });
    return results;
  }

  async queryEnts(): Promise<Map<ID, TDest[]>> {
    // applies filters and then gets things after
    const edges = await this.loadEdges();
    let promises: Promise<any>[] = [];
    const results: Map<ID, TDest[]> = new Map();

    const loadEntsForID = async (id: ID, edges: AssocEdge[]) => {
      const ids = edges.map((edge) => edge.id2);
      const ents = await loadEnts(this.viewer, this.ctr, ...ids);
      results.set(id, ents);
    };

    for (const [id, edgesList] of edges) {
      promises.push(loadEntsForID(id, edgesList));
    }

    await Promise.all(promises);
    return results;
  }

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

  private async loadRawEdges(options: EdgeQueryableDataOptions) {
    const ids = await this.resolveIDs();
    await Promise.all(
      ids.map(async (id) => {
        const edges = await loadEdges({
          id1: id,
          edgeType: this.edgeType,
          context: this.viewer.context,
          queryOptions: options,
        });
        this.edges.set(id, edges);
      }),
    );
  }

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

    await this.loadRawEdges(options);

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
}

export interface EdgeQueryCtr<T extends Ent> {
  new (viewer: Viewer, src: EdgeQuerySource<T>): EdgeQuery<T>;
}
