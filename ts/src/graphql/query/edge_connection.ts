import { EdgeQuery } from "../../core/query/query";
import { Data, Ent, ID, Viewer } from "../../core/base";

// TODO getCursor...
export interface GraphQLEdge<T extends Data> {
  edge: T;
  node: Ent;
  cursor: string;
}

interface edgeQueryCtr<T extends Ent, TEdge extends Data> {
  (v: Viewer, src: Ent): EdgeQuery<T, TEdge>;
}

// TODO probably need to template Ent. maybe 2 ents?
export class GraphQLEdgeConnection<TEdge extends Data> {
  query: EdgeQuery<Ent, TEdge>;
  private results: GraphQLEdge<TEdge>[] = [];

  constructor(
    private viewer: Viewer,
    private source: Ent,
    getQuery: edgeQueryCtr<Ent, TEdge>,
    private args?: Data,
  ) {
    this.query = getQuery(this.viewer, this.source);
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
  modifyQuery(fn: (query: EdgeQuery<Ent, TEdge>) => EdgeQuery<Ent, TEdge>) {
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

  async queryPageInfo() {
    await this.queryData();
    return (
      this.query.paginationInfo().get(this.source.id) || {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: "",
        endCursor: "",
      }
    );
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
