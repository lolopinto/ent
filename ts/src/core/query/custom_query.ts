import {
  Data,
  Ent,
  ID,
  EdgeQueryableDataOptions,
  LoadEntOptions,
  loadRows,
  loadRow,
  Viewer,
  applyPrivacyPolicyForRows,
  DefaultLimit,
} from "../ent";
import { BaseEdgeQuery } from "./query";
import * as clause from "../clause";

export class CustomEdgeQueryBase<TDest extends Ent> extends BaseEdgeQuery<
  TDest,
  Data
> {
  private id: ID;
  constructor(
    public viewer: Viewer,
    src: Ent | ID,
    private options: LoadEntOptions<TDest>,
    private clause: clause.Clause,
    private sortColumn: string = "created_at",
  ) {
    super(viewer, sortColumn);
    if (typeof src === "object") {
      this.id = src.id;
    } else {
      this.id = src;
    }
  }

  async queryRawCount(): Promise<Map<ID, number>> {
    const row = await loadRow({
      ...this.options,
      fields: ["count(1)"],
      clause: this.clause,
    });
    if (!row) {
      throw new Error(`could not find count`);
    }
    return new Map<ID, number>([[this.id, row.count]]);
  }

  protected async loadRawData(options: EdgeQueryableDataOptions) {
    let cls = this.clause;
    if (options.clause) {
      cls = clause.And(cls, options.clause);
    }
    if (!options.orderby) {
      options.orderby = `${this.sortColumn} DESC`;
    }
    if (!options.limit) {
      options.limit = DefaultLimit;
    }
    const rows = await loadRows({
      ...this.options,
      ...options,
      clause: cls,
      context: this.viewer.context,
    });
    this.edges.set(this.id, rows);
  }

  protected dataToID(edge: Data): ID {
    return edge.id;
  }

  protected async loadEntsFromEdges(id: ID, rows: Data[]): Promise<TDest[]> {
    const ents = await applyPrivacyPolicyForRows(
      this.viewer,
      rows,
      this.options,
    );
    //    console.log(ents);
    return Array.from(ents.values());
  }
}
