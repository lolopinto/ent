import {
  ID,
  Ent,
  Viewer,
  LoadEntOptions,
  EdgeQueryableDataOptions,
} from "../base";
import { AssocEdge, loadEnts } from "../ent";
import { AssocEdgeCountLoaderFactory } from "../loaders/assoc_count_loader";
import { AssocEdgeLoaderFactory } from "../loaders/assoc_edge_loader";
import { EdgeQuery, BaseEdgeQuery } from "./query";

// TODO no more plurals for privacy reasons?
export type EdgeQuerySource<T extends Ent> =
  | T
  | T[]
  | ID
  | ID[]
  | EdgeQuery<T, Ent, AssocEdge>;

type loaderOptionsFunc = (type: string) => LoadEntOptions<Ent>;

interface typeData {
  ids: ID[];
  options: LoadEntOptions<Ent>;
}

export class AssocEdgeQueryBase<
  TSource extends Ent,
  TDest extends Ent,
  TEdge extends AssocEdge,
> extends BaseEdgeQuery<TDest, TEdge> {
  private idsResolved: boolean;
  private resolvedIDs: ID[] = [];

  constructor(
    public viewer: Viewer,
    public src: EdgeQuerySource<TSource>,
    private countLoaderFactory: AssocEdgeCountLoaderFactory,
    private dataLoaderFactory: AssocEdgeLoaderFactory<TEdge>,
    // if function, it's a polymorphic edge and need to provide
    // a function that goes from edgeType to LoadEntOptions
    private options: LoadEntOptions<TDest> | loaderOptionsFunc,
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
      const idsMap = await this.src.queryAllIDs();
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
    obj: TSource | ID | EdgeQuery<TSource, Ent, AssocEdge>,
  ): obj is EdgeQuery<TSource, Ent, AssocEdge> {
    if ((obj as EdgeQuery<TSource, Ent, AssocEdge>).queryIDs !== undefined) {
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

  private async getSingleID() {
    const ids = await this.resolveIDs();
    if (ids.length !== 1) {
      throw new Error(
        "cannot call queryRawCount when more than one id is requested",
      );
    }
    return ids[0];
  }

  // doesn't work with filters...
  async queryRawCount(): Promise<number> {
    const id = await this.getSingleID();

    return this.countLoaderFactory.createLoader(this.viewer.context).load(id);
  }

  async queryAllRawCount(): Promise<Map<ID, number>> {
    let results: Map<ID, number> = new Map();
    const ids = await this.resolveIDs();

    const loader = this.countLoaderFactory.createLoader(this.viewer.context);
    await Promise.all(
      ids.map(async (id) => {
        const count = await loader.load(id);
        results.set(id, count);
      }),
    );
    return results;
  }

  protected async loadEntsFromEdges(
    id: ID,
    edges: AssocEdge[],
  ): Promise<TDest[]> {
    if (typeof this.options === "function") {
      const m = new Map<string, typeData>();
      for (const edge of edges) {
        const nodeType = edge.id2Type;
        let data = m.get(nodeType);
        if (data === undefined) {
          const opts = this.options(nodeType);
          if (opts === undefined) {
            throw new Error(
              `getLoaderOptions returned undefined for type ${nodeType}`,
            );
          }
          data = {
            ids: [],
            options: opts,
          };
        }
        data.ids.push(edge.id2);
        m.set(nodeType, data);
      }
      let promises: Promise<Ent[]>[] = [];
      for (const [_, value] of m) {
        promises.push(loadEnts(this.viewer, value.options, ...value.ids));
      }
      const entss = await Promise.all(promises);
      const r: Ent[] = [];
      for (const ents of entss) {
        r.push(...ents);
      }
      return r as TDest[];
    }
    const ids = edges.map((edge) => edge.id2);
    return await loadEnts(this.viewer, this.options, ...ids);
  }

  dataToID(edge: AssocEdge): ID {
    return edge.id2;
  }

  protected async loadRawData(options: EdgeQueryableDataOptions) {
    const ids = await this.resolveIDs();

    const loader = this.dataLoaderFactory.createConfigurableLoader(
      options,
      this.viewer.context,
    );
    await Promise.all(
      ids.map(async (id) => {
        // there'll be filters for special edges here...
        // and then depending on that, we use this
        // what happens if you do first(10).id2(XX)
        // doesn't make sense
        // so only makes sense if one of these...

        // Id2 needs to be an option
        const edges = await loader.load(id);
        this.edges.set(id, edges);
      }),
    );
  }

  async queryID2(id2: ID): Promise<TEdge | undefined> {
    const id = await this.getSingleID();

    const loader = this.dataLoaderFactory.createLoader(this.viewer.context);
    return loader.loadEdgeForID2(id, id2);
  }

  async queryAllID2(id2: ID): Promise<Map<ID, TEdge>> {
    const ids = await this.resolveIDs();

    const loader = this.dataLoaderFactory.createLoader(this.viewer.context);

    const m = new Map<ID, TEdge>();
    await Promise.all(
      ids.map(async (id) => {
        const edge = await loader.loadEdgeForID2(id, id2);
        if (edge) {
          m.set(id, edge);
        }
      }),
    );
    return m;
  }
}

export interface EdgeQueryCtr<T extends Ent, TEdge extends AssocEdge> {
  new (viewer: Viewer, src: EdgeQuerySource<T>): EdgeQuery<T, Ent, TEdge>;
}
