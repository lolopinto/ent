import {
  EdgeQueryableDataOptions,
  Ent,
  ID,
  LoadEntOptions,
  Viewer,
} from "../base.js";
import * as clause from "../clause.js";
import { AssocEdge, loadEdgeData, loadEntsList } from "../ent.js";
import { AssocEdgeCountLoaderFactory } from "../loaders/assoc_count_loader.js";
import { AssocEdgeLoaderFactory } from "../loaders/assoc_edge_loader.js";
import { BaseEdgeQuery, EdgeQuery, EdgeQueryFilter, IDInfo } from "./query.js";

// TODO no more plurals for privacy reasons?
export type EdgeQuerySource<
  TSource extends Ent<TViewer>,
  TDest extends Ent<TViewer> = Ent<any>,
  TViewer extends Viewer = Viewer,
> = TSource | TSource[] | ID | ID[] | EdgeQuery<TDest, Ent, AssocEdge>;

type loaderOptionsFunc<TViewer extends Viewer> = (
  type: string,
) => LoadEntOptions<Ent, TViewer>;

interface typeData {
  ids: ID[];
  options: LoadEntOptions<Ent>;
}

// would be nice to someday have an API for assoc asc
export abstract class AssocEdgeQueryBase<
    TSource extends Ent<TViewer>,
    TDest extends Ent<TViewer>,
    TEdge extends AssocEdge,
    TViewer extends Viewer = Viewer,
  >
  extends BaseEdgeQuery<TSource, TDest, TEdge>
  implements EdgeQuery<TSource, TDest, TEdge>
{
  private loadTwoWay: boolean = false;

  constructor(
    public viewer: TViewer,
    public src: EdgeQuerySource<TSource, TDest, TViewer>,
    private countLoaderFactory: AssocEdgeCountLoaderFactory,
    private dataLoaderFactory: AssocEdgeLoaderFactory<TEdge>,
    // if function, it's a polymorphic edge and need to provide
    // a function that goes from edgeType to LoadEntOptions
    private options:
      | LoadEntOptions<TDest, TViewer>
      | loaderOptionsFunc<TViewer>,
  ) {
    super(viewer, {
      cursorCol: "id2",
      orderby: [
        {
          column: "time",
          direction: "DESC",
        },
        {
          column: "id2",
          direction: "DESC",
        },
      ],
    });
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

  async getTableName(): Promise<string> {
    const edgeData = await loadEdgeData(this.countLoaderFactory.getEdgeType());
    if (!edgeData) {
      throw new Error(`couldn't load edgeData`);
    }
    return edgeData.edgeTable;
  }

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
      .createConfigurableLoader(
        this.getDefaultEdgeQueryOptions() ?? {},
        this.viewer.context,
      )
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
        promises.push(loadEntsList(this.viewer, value.options, ...value.ids));
      }
      const entss = await Promise.all(promises);
      const r: Ent[] = [];
      for (const ents of entss) {
        r.push(...ents);
      }
      return r as TDest[];
    }
    const ids = edges.map((edge) => edge.id2);
    return loadEntsList(this.viewer, this.options, ...ids);
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
        const edges = this.loadTwoWay
          ? await loader.loadTwoWay(info.id)
          : await loader.load(info.id);
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

  __beforeBETA(time: Date) {
    this.__assertNoFiltersBETA("before");
    this.__addCustomFilterBETA(new BeforeFilter(time));
    return this;
  }

  __afterBETA(time: Date) {
    this.__assertNoFiltersBETA("after");
    this.__addCustomFilterBETA(new AfterFilter(time));
    return this;
  }

  // start is inclusive, end is exclusive
  __withinBeta(start: Date, end: Date) {
    this.__assertNoFiltersBETA("within");
    this.__addCustomFilterBETA(new WithinFilter(start, end));
    return this;
  }

  /**
   * intersect multiple queries together with this one to get candidate edges
   * the edges returned will always be from the originating edge query
   *
   * @param others list of other queries to intersect with the source edge
   */
  __intersect(...others: AssocEdgeQueryBase<any, TDest, TEdge, TViewer>[]) {
    // TODO I don't really see a reason why we can't chain first or something first before this
    // but for now let's not support it
    // when we do this correctly, we'll allow chaining
    this.__assertNoFiltersBETA("intersect");
    this.__addCustomFilterBETA(new IntersectFilter(others));
    return this;
  }

  /**
   * union multiple queries together with this one to get candidate edges
   * if the edge exists in the source query, that's the edge returned
   * if the edge doesn't exist, the first edge in the list of queries that has the edge is returned
   * @param others list of other queries to union with the source edge
   */
  __union<TSource2 extends Ent<TViewer>>(
    ...others: AssocEdgeQueryBase<TSource2, TDest, TEdge, TViewer>[]
  ) {
    // same chain comment from intersect...
    this.__assertNoFiltersBETA("union");
    this.__addCustomFilterBETA(new UnionFilter(others));
    return this;
  }

  /**
   * this fetches edges where there's a two way connection between both sets of edges
   * e.g. in a social networking system, where the source and dest are both following each other
   *
   * will not work in the future when there's sharding...
   */
  __twoWay() {
    this.__assertNoFiltersBETA("twoWay");
    this.loadTwoWay = true;
    return this;
  }
}

export interface EdgeQueryCtr<
  TSource extends Ent,
  TDest extends Ent,
  TEdge extends AssocEdge,
> {
  new (
    viewer: Viewer,
    src: EdgeQuerySource<TSource>,
  ): EdgeQuery<TSource, TDest, TEdge>;
}

class BeforeFilter implements EdgeQueryFilter<AssocEdge> {
  constructor(private time: Date) {}

  query(options: EdgeQueryableDataOptions): EdgeQueryableDataOptions {
    const cls = clause.Less("time", this.time);

    options.clause = clause.AndOptional(options.clause, cls);

    return options;
  }
}

class AfterFilter implements EdgeQueryFilter<AssocEdge> {
  constructor(private time: Date) {}

  query(options: EdgeQueryableDataOptions): EdgeQueryableDataOptions {
    const cls = clause.Greater("time", this.time);

    options.clause = clause.AndOptional(options.clause, cls);

    return options;
  }
}

class WithinFilter implements EdgeQueryFilter<AssocEdge> {
  constructor(
    private start: Date,
    private end: Date,
  ) {}

  query(options: EdgeQueryableDataOptions): EdgeQueryableDataOptions {
    const cls = clause.And(
      clause.GreaterEq("time", this.start),
      clause.Less("time", this.end),
    );

    options.clause = clause.AndOptional(options.clause, cls);
    return options;
  }
}

class IntersectFilter<
  TDest extends Ent<TViewer>,
  TEdge extends AssocEdge,
  TViewer extends Viewer = Viewer,
> implements EdgeQueryFilter<TEdge>
{
  private edges: Array<Set<ID>> = [];
  constructor(
    private queries: AssocEdgeQueryBase<any, TDest, TEdge, TViewer>[],
  ) {}

  async fetch(): Promise<void> {
    let i = 0;
    // maybe future optimization. instead of this, use a SQL query if edge_types are the same
    for await (const query of this.queries) {
      const edges = await query.queryEdges();
      const set = new Set<ID>();
      edges.forEach((edge) => {
        set.add(edge.id2);
      });
      this.edges[i] = set;
      i++;
    }
  }

  filter(_id: ID, edges: TEdge[]): TEdge[] {
    return edges.filter((edge) => {
      return this.edges.every((set) => {
        return set.has(edge.id2);
      });
    });
  }
}

class UnionFilter<
  TDest extends Ent<TViewer>,
  TEdge extends AssocEdge,
  TViewer extends Viewer = Viewer,
> implements EdgeQueryFilter<TEdge>
{
  private edges: Array<TEdge[]> = [];
  constructor(
    private queries: AssocEdgeQueryBase<any, TDest, TEdge, TViewer>[],
  ) {}

  async fetch(): Promise<void> {
    let i = 0;
    // maybe future optimization. instead of this, use a SQL query if edge_types are the same
    for await (const query of this.queries) {
      const edges = await query.queryEdges();
      this.edges[i] = edges;
      i++;
    }
  }

  filter(_id: ID, edges: TEdge[]): TEdge[] {
    const set = new Set<ID>();
    const result: TEdge[] = [];
    for (const edge of edges) {
      set.add(edge.id2);
      result.push(edge);
    }

    for (const edges of this.edges) {
      for (const edge of edges) {
        if (set.has(edge.id2)) {
          continue;
        }
        result.push(edge);
        set.add(edge.id2);
      }
    }

    return result;
  }
}
