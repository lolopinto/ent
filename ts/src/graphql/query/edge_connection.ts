import { Data, Ent, ID, Viewer } from "../../core/base";
import {
  ConnectionQuery,
  EdgeQuery,
  PaginationInfo,
} from "../../core/query/query";

import { emptyPaginationInfo } from "../../core/query/pagination";

// TODO getCursor...
export interface GraphQLEdge<T extends Data> {
  edge: T;
  node: Ent;
  cursor: string;
}

type MaybePromise<T> = T | Promise<T>;

interface edgeQueryCtr<
  T extends Ent,
  TEdge extends Data,
  TViewer extends Viewer,
> {
  (v: TViewer, src: T): MaybePromise<EdgeQuery<T, Ent, TEdge>>;
}

interface edgeQueryCtr2<
  T extends Ent,
  TEdge extends Data,
  TViewer extends Viewer,
> {
  (v: TViewer): MaybePromise<EdgeQuery<T, Ent, TEdge>>;
}

// TODO probably need to template Ent. maybe 2 ents?
export class GraphQLEdgeConnection<
  TSource extends Ent,
  TEdge extends Data,
  TViewer extends Viewer = Viewer,
> {
  query: Promise<EdgeQuery<TSource, Ent, TEdge>>;
  private results: GraphQLEdge<TEdge>[] = [];
  private viewer: TViewer;
  private source?: TSource;
  private args?: Data;

  constructor(
    viewer: TViewer,
    source: TSource,
    getQuery: edgeQueryCtr<TSource, TEdge, TViewer>,
    args?: Data,
  );
  constructor(
    viewer: TViewer,
    getQuery: edgeQueryCtr2<TSource, TEdge, TViewer>,
    args?: Data,
  );
  constructor(
    viewer: TViewer,
    arg2: TSource | edgeQueryCtr2<TSource, TEdge, TViewer>,
    arg3: edgeQueryCtr<TSource, TEdge, TViewer> | Data,
    args?: Data,
  ) {
    this.viewer = viewer;

    let query: MaybePromise<EdgeQuery<TSource, Ent, TEdge>>;

    if (typeof arg2 === "function") {
      query = arg2(this.viewer);
    } else {
      this.source = arg2;
    }
    if (typeof arg3 === "function") {
      query = arg3(this.viewer, this.source!);
    } else {
      this.args = arg3;
    }

    this.query = Promise.resolve(query!);

    if (args !== undefined) {
      this.args = args;
    }
    if (this.args) {
      if (this.args.after && !this.args.first) {
        throw new Error("cannot process after without first");
      }
      if (this.args.before && !this.args.before) {
        throw new Error("cannot process before without last");
      }
      if (this.args.first) {
        const argFirst = this.args.first;
        const argAfter = this.args.after;
        this.query = this.query.then((query) =>
          query.first(argFirst, argAfter),
        );
      }
      if (this.args.last) {
        const argLast = this.args.last;
        const argBefore = this.args.before;
        this.query = this.query.then((query) => query.last(argLast, argBefore));
      }
      // TODO custom args
      // how to proceed
    }
  }

  first(limit: number, cursor?: string) {
    this.query = this.query.then((query) => query.first(limit, cursor));
  }

  last(limit: number, cursor?: string) {
    this.query = this.query.then((query) => query.last(limit, cursor));
  }

  // any custom filters can be applied here...
  modifyQuery(
    fn: (
      query: EdgeQuery<TSource, Ent, TEdge>,
    ) => EdgeQuery<TSource, Ent, TEdge>,
  ) {
    this.query = this.query.then((query) => fn(query));
  }

  async queryTotalCount() {
    return (await this.getConnectionQuery()).queryRawCount();
  }

  async queryEdges() {
    // because of privacy, we need to query the node regardless of if the node is there
    // otherwise we'd be returning a phantom edge that doesn't actually exist
    await this.queryData();
    return this.results;
  }

  // if nodes queried just return ents
  // unlikely to query nodes and pageInfo so we just load this separately for now
  async queryNodes() {
    return (await this.getConnectionQuery()).queryEnts();
  }

  private async getConnectionQuery(): Promise<ConnectionQuery<Ent, TEdge>> {
    return asConnectionQuery(await this.query, this.source?.id);
  }

  async queryPageInfo(): Promise<PaginationInfo> {
    return (await this.getConnectionQuery()).queryPageInfo();
  }

  private async queryData() {
    const query = await this.getConnectionQuery();
    const [edges, ents] = await Promise.all([
      // TODO need a test that this will only fetch edges once
      // and then fetch ents afterward
      query.queryEdges(),
      query.queryEnts(),
    ]);

    let entsMap = new Map<ID, Ent>();
    ents.forEach((ent) => entsMap.set(ent.id, ent));

    let results: GraphQLEdge<TEdge>[] = [];
    for (const edge of edges) {
      const node = entsMap.get(query.dataToID(edge));
      if (!node) {
        continue;
      }
      results.push({
        edge,
        node,
        cursor: query.getCursor(edge),
      });
    }
    this.results = results;
  }
}

// Preserve the public EdgeQuery factory/.query/modifyQuery surface for existing
// callers. Internally, a connection only reads one result and one page of it.
// The map fallback supports third-party EdgeQuery implementations predating the
// singular accessor; it never assigns an authorization source to a query.
function asConnectionQuery<TSource extends Ent, TEdge extends Data>(
  query: EdgeQuery<TSource, Ent, TEdge>,
  parentID?: ID,
): ConnectionQuery<Ent, TEdge> {
  return {
    queryEdges: () => query.queryEdges(),
    queryEnts: () => query.queryEnts(),
    queryIDs: () => query.queryIDs(),
    queryCount: () => query.queryCount(),
    queryRawCount: () => query.queryRawCount(),
    dataToID: (row) => query.dataToID(row),
    getCursor: (row) => query.getCursor(row),
    first: (n, cursor) => asConnectionQuery(query.first(n, cursor), parentID),
    last: (n, cursor) => asConnectionQuery(query.last(n, cursor), parentID),
    queryPageInfo: async () => {
      if (query.queryPageInfo) {
        return query.queryPageInfo();
      }
      await query.queryEdges();
      const pages = query.paginationInfo();
      if (parentID !== undefined) {
        return pages.get(parentID) ?? emptyPaginationInfo();
      }
      if (pages.size > 1) {
        throw new Error("Query has more than one item yet no source was given");
      }
      return pages.values().next().value ?? emptyPaginationInfo();
    },
  };
}
