import {
  Data,
  Ent,
  ID,
  EdgeQueryableDataOptions,
  LoadEntOptions,
  Viewer,
  LoaderFactory,
  ConfigurableLoaderFactory,
} from "../base";
import { applyPrivacyPolicyForRows, DefaultLimit } from "../ent";
import { BaseEdgeQuery, IDInfo, EdgeQuery } from "./query";

export interface CustomEdgeQueryOptions<
  TSource extends Ent,
  TDest extends Ent,
> {
  src: TSource | ID;
  countLoaderFactory: LoaderFactory<ID, number>;
  dataLoaderFactory: ConfigurableLoaderFactory<ID, Data[]>;
  options: LoadEntOptions<TDest>;
  // // defaults to created_at
  sortColumn?: string;
}

export abstract class CustomEdgeQueryBase<
    TSource extends Ent,
    TDest extends Ent,
  >
  extends BaseEdgeQuery<TSource, TDest, Data>
  implements EdgeQuery<TSource, TDest, Data>
{
  private id: ID;
  constructor(
    public viewer: Viewer,
    private options: CustomEdgeQueryOptions<TSource, TDest>,
  ) {
    super(viewer, options.sortColumn || "created_at");
    options.sortColumn = options.sortColumn || "created_at";
    if (typeof options.src === "object") {
      this.id = options.src.id;
    } else {
      this.id = options.src;
    }
  }

  abstract sourceEnt(id: ID): Promise<Ent | null>;

  private async idVisible() {
    const ids = await this.genIDInfosToFetch();
    if (ids.length !== 1) {
      throw new Error("invalid number of IDInfo");
    }
    return !ids[0].invalidated;
  }

  async queryRawCount(): Promise<number> {
    const idVisible = await this.idVisible();
    if (!idVisible) {
      return 0;
    }

    return await this.options.countLoaderFactory
      .createLoader(this.viewer.context)
      .load(this.id);
  }

  async queryAllRawCount(): Promise<Map<ID, number>> {
    let count = 0;
    const idVisible = await this.idVisible();
    if (idVisible) {
      count = await this.queryRawCount();
    }
    return new Map<ID, number>([[this.id, count]]);
  }

  protected async loadRawIDs(
    addID: (src: ID | TSource) => void,
  ): Promise<void> {
    addID(this.options.src);
  }

  protected async loadRawData(
    infos: IDInfo[],
    options: EdgeQueryableDataOptions,
  ) {
    const loader = this.options.dataLoaderFactory.createConfigurableLoader(
      options,
      this.viewer.context,
    );
    if (!options.orderby) {
      options.orderby = `${this.options.sortColumn} DESC`;
    }
    if (!options.limit) {
      options.limit = DefaultLimit;
    }
    if (infos.length !== 1) {
      throw new Error(
        `expected 1 info passed to loadRawData. ${infos.length} passed`,
      );
    }
    const info = infos[0];
    if (info.invalidated) {
      this.edges.set(this.id, []);
      return;
    }
    const rows = await loader.load(this.id);
    this.edges.set(this.id, rows);
  }

  dataToID(edge: Data): ID {
    return edge.id;
  }

  protected async loadEntsFromEdges(id: ID, rows: Data[]): Promise<TDest[]> {
    const ents = await applyPrivacyPolicyForRows(
      this.viewer,
      rows,
      this.options.options,
    );
    return Array.from(ents.values());
  }
}
