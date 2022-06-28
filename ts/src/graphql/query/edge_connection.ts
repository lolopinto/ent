import { EdgeQuery, PaginationInfo } from "../../core/query/query";
import { Data, Ent, ID, Viewer } from "../../core/base";

// TODO getCursor...
export interface GraphQLEdge<T extends Data> {
  edge: T;
  node: Ent;
  cursor: string;
}

interface edgeQueryCtr<T extends Ent, TEdge extends Data> {
  (v: Viewer, src: T): EdgeQuery<T, Ent, TEdge>;
}

interface edgeQueryCtr2<T extends Ent, TEdge extends Data> {
  (v: Viewer): EdgeQuery<T, Ent, TEdge>;
}

// TODO probably need to template Ent. maybe 2 ents?
export class GraphQLEdgeConnection<TSource extends Ent, TEdge extends Data> {
  query: EdgeQuery<TSource, Ent, TEdge>;
  private results: GraphQLEdge<TEdge>[] = [];
  private viewer: Viewer;
  private source?: TSource;
  private args?: Data;

  constructor(
    viewer: Viewer,
    source: TSource,
    getQuery: edgeQueryCtr<TSource, TEdge>,
    args?: Data,
  );
  constructor(
    viewer: Viewer,
    getQuery: edgeQueryCtr2<TSource, TEdge>,
    args?: Data,
  );
  constructor(
    viewer: Viewer,
    arg2: TSource | edgeQueryCtr2<TSource, TEdge>,
    arg3: edgeQueryCtr<TSource, TEdge> | Data,
    args?: Data,
  ) {
    this.viewer = viewer;
    if (typeof arg2 === "function") {
      this.query = arg2(this.viewer);
    } else {
      this.source = arg2;
    }
    if (typeof arg3 === "function") {
      this.query = arg3(this.viewer, this.source!);
    } else {
      this.args = arg3;
    }
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
        this.query = this.query.first(this.args.first, this.args.after);
      }
      if (this.args.last) {
        this.query = this.query.last(this.args.last, this.args.cursor);
      }
      // TODO custom args
      // how to proceed
    }
  }

  first(limit: number, cursor?: string) {
    this.query = this.query.first(limit, cursor);
  }

  last(limit: number, cursor?: string) {
    this.query = this.query.last(limit, cursor);
  }

  // any custom filters can be applied here...
  modifyQuery(
    fn: (
      query: EdgeQuery<TSource, Ent, TEdge>,
    ) => EdgeQuery<TSource, Ent, TEdge>,
  ) {
    this.query = fn(this.query);
  }

  async queryTotalCount() {
    return await this.query.queryRawCount();
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
    return await this.query.queryEnts();
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
    const paginationInfo = this.query.paginationInfo();
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
    const [edges, ents] = await Promise.all([
      // TODO need a test that this will only fetch edges once
      // and then fetch ents afterward
      this.query.queryEdges(),
      this.query.queryEnts(),
    ]);

    let entsMap = new Map<ID, Ent>();
    ents.forEach((ent) => entsMap.set(ent.id, ent));

    let results: GraphQLEdge<TEdge>[] = [];
    for (const edge of edges) {
      const node = entsMap.get(this.query.dataToID(edge));
      if (!node) {
        continue;
      }
      results.push({
        edge,
        node,
        cursor: this.query.getCursor(edge),
      });
    }
    this.results = results;
  }
}
