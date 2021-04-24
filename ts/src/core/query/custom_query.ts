import {
  Data,
  Ent,
  ID,
  EdgeQueryableDataOptions,
  LoadEntOptions,
  loadRows,
  Viewer,
  applyPrivacyPolicyForRows,
  DefaultLimit,
} from "../ent";
import { BaseEdgeQuery } from "./query";
import * as clause from "../clause";
import { LoaderFactory } from "../loader_interfaces";

export interface CustomEdgeQueryOptions<T extends Ent> {
  src: Ent | ID;
  countLoaderFactory: LoaderFactory<ID, number>;
  // TODO???
  //  dataLoaderFactory: LoaderFactory<ID, Data>;
  // TODO filters...
  // TODO...
  options: LoadEntOptions<T>;
  // TODO
  clause: clause.Clause;
  // defaults to created_at
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

  // TODO...
  protected async loadRawData(options: EdgeQueryableDataOptions) {
    let cls = this.options.clause;
    if (options.clause) {
      cls = clause.And(cls, options.clause);
    }
    if (!options.orderby) {
      options.orderby = `${this.options.sortColumn} DESC`;
    }
    if (!options.limit) {
      options.limit = DefaultLimit;
    }
    const rows = await loadRows({
      ...this.options.options,
      ...options,
      clause: cls,
      context: this.viewer.context,
    });
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
    //    console.log(ents);
    return Array.from(ents.values());
  }
}
