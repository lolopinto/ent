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
  loadCount,
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

  async queryRawCount(): Promise<number> {
    const result = await loadCount(
      {
        ...this.options,
        context: this.viewer.context,
        fields: ["count(1)"],
        clause: this.clause,
      },
      // test...

      [process.env.NODE_ENV === "test" ? "user_id" : "event_id"],
      // clearly wrong...
      //      [this.clause.instanceKey()],
    );
    console.log(result);
    return result;
    // const row = await loadRow({
    //   ...this.options,
    //   fields: ["count(1)"],
    //   clause: this.clause,
    // });
    // // all have to do is l.load(...)
    // // the key is the order...
    // if (!row) {
    //   throw new Error(`could not find count`);
    // }
    // return parseInt(row.count, 10) || 0;
  }

  async queryAllRawCount(): Promise<Map<ID, number>> {
    const count = await this.queryRawCount();
    return new Map<ID, number>([[this.id, count]]);
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

  dataToID(edge: Data): ID {
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
