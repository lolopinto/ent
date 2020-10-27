import { EdgeQuery, EdgeQueryCtr } from "../../core/query";
import { AssocEdge, Ent, ID, Viewer } from "../../core/ent";

export interface GraphQLEdge {
  edge: AssocEdge; // TODO this should be an interface
  node: Ent;
}

export class GraphQLEdgeConnection {
  private query: EdgeQuery<Ent>;
  private results: GraphQLEdge[] = [];

  constructor(
    private viewer: Viewer,
    private source: Ent,
    ctr: EdgeQueryCtr<Ent>,
  ) {
    // TODO make viewer same?
    this.query = new ctr(this.viewer, this.source);
  }

  // TODO change these when the filters change...
  firstN(limit: number) {
    this.query = this.query.firstN(limit);
  }

  lastN(limit: number) {
    this.query = this.query.lastN(limit);
  }

  afterCursor(cursor: string, limit: number) {
    this.query = this.query.afterCursor(cursor, limit);
  }

  beforeCursor(cursor: string, limit: number) {
    this.query = this.query.beforeCursor(cursor, limit);
  }

  // any custom filters can be applied here...
  modifyQuery(fn: (query: EdgeQuery<Ent>) => EdgeQuery<Ent>) {
    this.query = fn(this.query);
  }

  async queryTotalCount() {
    const countMap = await this.query.queryRawCount();
    return countMap.get(this.source.id) || 0;
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
    const entsMap = await this.query.queryEnts();
    return entsMap.get(this.source.id) || [];
  }

  async queryPageInfo() {
    await this.queryData();
    // TODO
  }

  private async queryData() {
    // querying edges and ents at the same time is broken...
    const [m1, m2] = await Promise.all([
      // TODO need a test that this will only fetch edges once
      // and then fetch ents afterward
      this.query.queryEdges(),
      this.query.queryEnts(),
    ]);

    let entsMap = new Map<ID, Ent>();
    const edges = m1.get(this.source.id) || [];
    (m2.get(this.source.id) || []).forEach((ent) => entsMap.set(ent.id, ent));

    let results: GraphQLEdge[] = [];
    for (const edge of edges) {
      const node = entsMap.get(edge.id2);
      if (!node) {
        continue;
      }
      results.push({
        edge,
        node,
      });
    }
    this.results = results;
    // next construct pageInfo from this
    //    let resuls

    // check if ent is there and if
  }
}

// edges
// pageInfo
