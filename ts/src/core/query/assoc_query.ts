import {
  ID,
  AssocEdge,
  Ent,
  Viewer,
  loadRawEdgeCountX,
  LoadEntOptions,
  loadEnts,
  EdgeQueryableDataOptions,
  AssocEdgeConstructor,
  loadCustomEdges,
} from "../ent";
import { EdgeQuery, BaseEdgeQuery } from "./query";

// TODO no more plurals for privacy reasons?
export type EdgeQuerySource<T extends Ent> =
  | T
  | T[]
  | ID
  | ID[]
  | EdgeQuery<T, AssocEdge>;

export class AssocEdgeQueryBase<
  TSource extends Ent,
  TDest extends Ent,
  TEdge extends AssocEdge
> extends BaseEdgeQuery<TDest, TEdge> {
  private idsResolved: boolean;
  private resolvedIDs: ID[] = [];

  constructor(
    public viewer: Viewer,
    public src: EdgeQuerySource<TSource>,
    private edgeType: string,
    private options: LoadEntOptions<TDest>,
    private edgeCtr: AssocEdgeConstructor<TEdge>,
  ) {
    super(viewer, "time");
  }

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
    obj: TSource | ID | EdgeQuery<TSource, AssocEdge>,
  ): obj is EdgeQuery<TSource, AssocEdge> {
    if ((obj as EdgeQuery<TSource, AssocEdge>).queryIDs !== undefined) {
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

  protected async loadEntsFromEdges(
    id: ID,
    edges: AssocEdge[],
  ): Promise<TDest[]> {
    const ids = edges.map((edge) => edge.id2);
    return await loadEnts(this.viewer, this.options, ...ids);
  }

  dataToID(edge: AssocEdge): ID {
    return edge.id2;
  }

  protected async loadRawData(options: EdgeQueryableDataOptions) {
    const ids = await this.resolveIDs();
    await Promise.all(
      ids.map(async (id) => {
        const edges = await loadCustomEdges({
          id1: id,
          edgeType: this.edgeType,
          context: this.viewer.context,
          queryOptions: options,
          ctr: this.edgeCtr,
        });
        this.edges.set(id, edges);
      }),
    );
  }
}

export interface EdgeQueryCtr<T extends Ent, TEdge extends AssocEdge> {
  new (viewer: Viewer, src: EdgeQuerySource<T>): EdgeQuery<T, TEdge>;
}
