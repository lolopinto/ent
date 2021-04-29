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
import { BaseEdgeQuery } from "./query";

export interface CustomEdgeQueryOptions<T extends Ent> {
  src: Ent | ID;
  countLoaderFactory: LoaderFactory<ID, number>;
  dataLoaderFactory: ConfigurableLoaderFactory<ID, Data[]>;
  options: LoadEntOptions<T>;
  // // defaults to created_at
  sortColumn?: string;
}

export class CustomEdgeQueryBase<TDest extends Ent> extends BaseEdgeQuery<
  TDest,
  Data
> {
  private id: ID;
  constructor(
    public viewer: Viewer,
    private options: CustomEdgeQueryOptions<TDest>, // src: Ent | ID, // private options: LoadEntOptions<TDest>, // private clause: clause.Clause, // // count loaderFactory // // TODO make this an options array // private loaderFactory: LoaderFactory<ID, number>, // private sortColumn: string = "created_at",
  ) {
    super(viewer, options.sortColumn || "created_at");
    options.sortColumn = options.sortColumn || "created_at";
    if (typeof options.src === "object") {
      this.id = options.src.id;
    } else {
      this.id = options.src;
    }
  }

  async queryRawCount(): Promise<number> {
    return await this.options.countLoaderFactory
      .createLoader(this.viewer.context)
      .load(this.id);
  }

  async queryAllRawCount(): Promise<Map<ID, number>> {
    const count = await this.queryRawCount();
    return new Map<ID, number>([[this.id, count]]);
  }

  protected async loadRawData(options: EdgeQueryableDataOptions) {
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
