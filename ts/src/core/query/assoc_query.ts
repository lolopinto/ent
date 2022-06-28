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
import { EdgeQuery, BaseEdgeQuery, IDInfo } from "./query";

// TODO no more plurals for privacy reasons?
export type EdgeQuerySource<TSource extends Ent, TDest extends Ent = Ent> =
  | TSource
  | TSource[]
  | ID
  | ID[]
  | EdgeQuery<TDest, Ent, AssocEdge>;

type loaderOptionsFunc = (type: string) => LoadEntOptions<Ent>;

interface typeData {
  ids: ID[];
  options: LoadEntOptions<Ent>;
}

export abstract class AssocEdgeQueryBase<
    TSource extends Ent,
    TDest extends Ent,
    TEdge extends AssocEdge,
  >
  extends BaseEdgeQuery<TSource, TDest, TEdge>
  implements EdgeQuery<TSource, TDest, TEdge>
{
  constructor(
    public viewer: Viewer,
    public src: EdgeQuerySource<TSource, TDest>,
    private countLoaderFactory: AssocEdgeCountLoaderFactory,
    private dataLoaderFactory: AssocEdgeLoaderFactory<TEdge>,
    // if function, it's a polymorphic edge and need to provide
    // a function that goes from edgeType to LoadEntOptions
    private options: LoadEntOptions<TDest> | loaderOptionsFunc,
  ) {
    super(viewer, "time");
  }

  private isEdgeQuery(
    obj: TSource | ID | EdgeQuery<TDest, Ent, AssocEdge>,
  ): obj is EdgeQuery<TDest, Ent, AssocEdge> {
    if ((obj as EdgeQuery<TDest, Ent, AssocEdge>).queryIDs !== undefined) {
      return true;
    }
    return false;
  }

  abstract sourceEnt(id: ID): Promise<Ent | null>;

  private async getSingleID() {
    const infos = await this.genIDInfosToFetch();
    if (infos.length !== 1) {
      throw new Error(
        "cannot call queryRawCount when more than one id is requested",
      );
    }
    return infos[0];
  }

  // doesn't work with filters...
  async queryRawCount(): Promise<number> {
    const info = await this.getSingleID();
    if (info.invalidated) {
      return 0;
    }

    return this.countLoaderFactory
      .createLoader(this.viewer.context)
      .load(info.id);
  }

  async queryAllRawCount(): Promise<Map<ID, number>> {
    let results: Map<ID, number> = new Map();
    const infos = await this.genIDInfosToFetch();

    const loader = this.countLoaderFactory.createLoader(this.viewer.context);
    await Promise.all(
      infos.map(async (info) => {
        if (info.invalidated) {
          results.set(info.id, 0);
          return;
        }
        const count = await loader.load(info.id);
        results.set(info.id, count);
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

  protected async loadRawIDs(addID: (src: ID | TSource) => void) {
    if (Array.isArray(this.src)) {
      this.src.forEach((obj: TSource | ID) => addID(obj));
    } else if (this.isEdgeQuery(this.src)) {
      const idsMap = await this.src.queryAllIDs();
      for (const [_, ids] of idsMap) {
        ids.forEach((id) => addID(id));
      }
    } else {
      addID(this.src);
    }
  }

  protected async loadRawData(
    infos: IDInfo[],
    options: EdgeQueryableDataOptions,
  ) {
    const loader = this.dataLoaderFactory.createConfigurableLoader(
      options,
      this.viewer.context,
    );

    await Promise.all(
      infos.map(async (info) => {
        if (info.invalidated) {
          this.edges.set(info.id, []);
          return;
        }
        // there'll be filters for special edges here...
        // and then depending on that, we use this
        // what happens if you do first(10).id2(XX)
        // doesn't make sense
        // so only makes sense if one of these...

        // Id2 needs to be an option
        const edges = await loader.load(info.id);
        this.edges.set(info.id, edges);
      }),
    );
  }

  async queryID2(id2: ID): Promise<TEdge | undefined> {
    const info = await this.getSingleID();
    if (info.invalidated) {
      return;
    }

    const loader = this.dataLoaderFactory.createLoader(this.viewer.context);
    return loader.loadEdgeForID2(info.id, id2);
  }

  async queryAllID2(id2: ID): Promise<Map<ID, TEdge>> {
    const infos = await this.genIDInfosToFetch();

    const loader = this.dataLoaderFactory.createLoader(this.viewer.context);

    const m = new Map<ID, TEdge>();
    await Promise.all(
      infos.map(async (info) => {
        if (info.invalidated) {
          return;
        }
        const edge = await loader.loadEdgeForID2(info.id, id2);
        if (edge) {
          m.set(info.id, edge);
        }
      }),
    );
    return m;
  }
}

export interface EdgeQueryCtr<
  TSource extends Ent,
  TDest extends Ent,
  TEdge extends AssocEdge,
> {
  new (viewer: Viewer, src: EdgeQuerySource<TSource>): EdgeQuery<
    TSource,
    TDest,
    TEdge
  >;
}
