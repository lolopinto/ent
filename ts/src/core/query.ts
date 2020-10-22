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
} from "./ent";
import * as clause from "./clause";

export interface EdgeQuery<T extends Ent> {
  sql(): EdgeQuery<T>;
  queryEdges(): Promise<Map<ID, AssocEdge[]>>;
  queryIDs(): Promise<Map<ID, ID[]>>;
  queryCount(): Promise<Map<ID, number>>;
  queryRawCount(): Promise<Map<ID, number>>;
  queryEnts(): Promise<Map<ID, T[]>>;
  // no offset/limit based
  firstN(n: number): EdgeQuery<T>;
  lastN(n: number): EdgeQuery<T>;
  beforeCursor(cursor: string, limit: number): EdgeQuery<T>;
  afterCursor(cursor: string, limit: number): EdgeQuery<T>;

  // TODO we need a way to handle singular id for e.g. unique edge
}

interface EdgeQueryFilter {
  // this is a filter that does the processing in TypeScript instead of at the SQL layer
  filter?(edges: AssocEdge[]): AssocEdge[];

  // there's 2 ways to do it.
  // apply it in SQL
  // or process it after the fact
  query?(options: EdgeQueryableDataOptions): EdgeQueryableDataOptions;
  // maybe it's a dynamic decision to do so and then query returns what was passed to it and filter returns what was passed to it based on the decision flow
  //  preProcess
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

class FirstNFilter implements EdgeQueryFilter {
  private sql: boolean;
  constructor(private n: number) {
    assertPositive(n);
  }

  filter(edges: AssocEdge[]): AssocEdge[] {
    return this.sql ? edges : edges.slice(0, this.n);
  }

  query(options: EdgeQueryableDataOptions): EdgeQueryableDataOptions {
    this.sql = true;
    return {
      ...options,
      limit: this.n,
    };
  }
}

class LastNFilter implements EdgeQueryFilter {
  constructor(private n: number) {
    assertPositive(n);
  }

  filter(edges: AssocEdge[]): AssocEdge[] {
    return edges.slice(edges.length - this.n, edges.length);
  }
  // not doing sql with lastN because we don't know length...
}

class AfterCursor implements EdgeQueryFilter {
  private time: number;
  constructor(cursor: string, private limit: number) {
    this.time = assertValidCursor(cursor);
  }

  // same as BeforeCursor
  // filter(edges: AssocEdge[]): AssocEdge[] {
  //   return edges;
  // }

  query(options: EdgeQueryableDataOptions): EdgeQueryableDataOptions {
    // we sort by most recent first
    // so when paging backwards, we fetch afterCursor X
    return {
      ...options,
      clause: clause.Greater("time", this.time),
      orderby: "time ASC",
      limit: this.limit,
    };
  }
}

// support paging back
// make this optional...

// TODO provide ways to parse cursor and handle this in the future
class BeforeCursor implements EdgeQueryFilter {
  private time: number;
  constructor(cursor: string, private limit: number) {
    this.time = assertValidCursor(cursor);
  }

  // for beforeCursor query, everything is done in sql (for now) and not done in
  // application land
  // eventually once we have caching etc, this won't make sense as we'd cache
  // say the last 1k or 5k or 10k edges depending on the edge and then do the
  // filtering in node-land since the cache is cheap
  // filter(edges: AssocEdge[]): AssocEdge[] {
  //   return edges;
  // }

  query(options: EdgeQueryableDataOptions): EdgeQueryableDataOptions {
    // we sort by most recent first
    // so when paging, we fetch beforeCursor X
    return {
      ...options,
      clause: clause.Less("time", this.time),
      // just to be explicit even though this is the default
      orderby: "time DESC",
      limit: this.limit,
    };
  }
}

export type EdgeQuerySource<T extends Ent> = T | T[] | ID | ID[] | EdgeQuery<T>;

export class BaseEdgeQuery<TSource extends Ent, TDest extends Ent> {
  private filters: EdgeQueryFilter[] = [];
  private queryDispatched: boolean;
  private idsResolved: boolean;
  private edges: Map<ID, AssocEdge[]> = new Map();
  private resolvedIDs: ID[] = [];
  private sqlMode: boolean;

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

  sql(): this {
    if (this.filters.length) {
      throw new Error("cannot go into sql mode after filters set");
    }
    this.sqlMode = true;
    return this;
  }

  firstN(n: number): this {
    this.filters.push(new FirstNFilter(n));
    return this;
  }

  lastN(n: number): this {
    this.filters.push(new LastNFilter(n));
    return this;
  }

  beforeCursor(cursor: string, n: number): this {
    this.filters.push(new BeforeCursor(cursor, n));
    return this;
  }

  afterCursor(cursor: string, n: number): this {
    this.filters.push(new AfterCursor(cursor, n));
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
    // TODO how does one memoize this call?
    this.queryDispatched = true;

    let options: EdgeQueryableDataOptions = {};
    if (this.sqlMode) {
      this.filters.forEach((filter) => {
        if (filter.query) {
          options = filter.query(options);
        }
      });
    }

    await this.loadRawEdges(options);

    // no filters. nothing to do here.
    if (!this.filters.length) {
      return this.edges;
    }

    // filter as needed
    for (let [id, edges] of this.edges) {
      this.filters.forEach((filter) => {
        if (filter.filter) {
          edges = filter.filter(edges);
        }
      });
      this.edges.set(id, edges);
    }
    return this.edges;
  }
}
