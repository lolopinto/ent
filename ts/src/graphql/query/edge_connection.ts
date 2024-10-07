import { CustomClauseQuery } from "../../core/query";
import { Data, Ent, ID, Viewer } from "../../core/base";
import { EdgeQuery, PaginationInfo } from "../../core/query/query";

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

    async function resolveQuery(
      query: MaybePromise<EdgeQuery<TSource, Ent, TEdge>>,
      source: TSource | undefined,
    ) {
      const resolved = await query;

      // https://github.com/lolopinto/ent/issues/1836
      if (resolved instanceof CustomClauseQuery && source !== undefined) {
        resolved.__setSource(source);
      }
      return resolved;
    }

    let maybeQuery: MaybePromise<EdgeQuery<TSource, Ent, TEdge>>;
    let source: TSource | undefined;

    if (typeof arg2 === "function") {
      maybeQuery = arg2(this.viewer);
    } else {
      this.source = arg2;
      source = arg2;
    }
    if (typeof arg3 === "function") {
      maybeQuery = arg3(this.viewer, this.source!);
    } else {
      this.args = arg3;
    }

    this.query = Promise.resolve(resolveQuery(maybeQuery!, source));

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
    return (await this.query).queryRawCount();
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
    return (await this.query).queryEnts();
  }

  private defaultPageInfo() {
    return {
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: "",
      endCursor: "",
    };
  }

  async queryPageInfo(): Promise<PaginationInfo> {
    await this.queryData();
    const paginationInfo = (await this.query).paginationInfo();
    if (this.source !== undefined) {
      return paginationInfo.get(this.source.id) || this.defaultPageInfo();
    }
    if (paginationInfo.size > 1) {
      throw new Error(`Query mas more than one item yet no source was given`);
    }
    for (const [_, value] of paginationInfo) {
      return value;
    }
    return this.defaultPageInfo();
  }

  private async queryData() {
    const query = await this.query;
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
