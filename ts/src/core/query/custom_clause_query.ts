import {
  Data,
  EdgeQueryableDataOptions,
  Ent,
  ID,
  LoadEntOptions,
  Viewer,
} from "../base";
import { AndOptional, Clause } from "../clause";
import {
  applyPrivacyPolicyForRows,
  DefaultLimit,
  loadRow,
  loadRows,
} from "../ent";

import { getOrderBy } from "../loaders/query_loader";
import { BaseEdgeQuery, IDInfo } from "./query";

interface CustomClauseQueryOptions<
  TDest extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
> {
  loadEntOptions: LoadEntOptions<TDest, TViewer>;
  clause: Clause;
  // query-name used to create loaders...
  // and then from there it does what it needs to do to do the right thing...
  name: string;
  // defaults to id
  sortColumn?: string;
  // pass this if the sort column is unique and it'll be used for the cursor and used to
  // generate the query
  sortColumnUnique?: boolean;
  orderByDirection?: "asc" | "desc";

  disableTransformations?: boolean;
}

function getClause<TDest extends Ent<TViewer>, TViewer extends Viewer = Viewer>(
  opts: CustomClauseQueryOptions<TDest, TViewer>,
) {
  let cls = opts.clause;
  if (opts.disableTransformations) {
    return cls;
  }
  let optClause = opts.loadEntOptions.loaderFactory?.options?.clause;
  if (typeof optClause === "function") {
    optClause = optClause();
  }
  if (!optClause) {
    return cls;
  }
  return AndOptional(cls, optClause);
}

export class CustomClauseQuery<
  TDest extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
> extends BaseEdgeQuery<any, TDest, Data> {
  private clause: Clause;
  constructor(
    public viewer: TViewer,
    private options: CustomClauseQueryOptions<TDest, TViewer>,
  ) {
    let sortCol = options.sortColumn || "id";
    let unique = options.sortColumnUnique
      ? sortCol
      : options.loadEntOptions.loaderFactory.options?.key || "id";

    // pass direction to base class since it uses it
    // this API needs to be cleaned up...
    if (options.orderByDirection) {
      sortCol = `${sortCol} ${options.orderByDirection}`;
    }
    super(viewer, sortCol, unique);
    this.clause = getClause(options);
  }

  async sourceEnt(_id: ID) {
    return null;
  }

  getTableName() {
    return this.options.loadEntOptions.tableName;
  }

  async queryRawCount(): Promise<number> {
    const row = await loadRow({
      tableName: this.options.loadEntOptions.tableName,
      // sqlite needs as count otherwise it returns count(1)
      fields: ["count(1) as count"],
      clause: this.clause,
      context: this.viewer.context,
    });
    return parseInt(row?.count, 10) || 0;
  }

  async queryAllRawCount(): Promise<Map<ID, number>> {
    throw new Error(`queryAllRawCount doesn't make sense in CustomClauseQuery`);
  }

  // nothing to do here
  protected async loadRawIDs(_addID: (src: ID) => void): Promise<void> {}

  protected async loadRawData(
    _infos: IDInfo[],
    options: EdgeQueryableDataOptions,
  ) {
    if (!options.orderby) {
      const direction = this.options.orderByDirection ?? "desc";
      options.orderby = `${this.options.sortColumn} ${direction}`;
    }
    if (!options.limit) {
      options.limit = DefaultLimit;
    }

    const rows = await loadRows({
      tableName: this.options.loadEntOptions.tableName,
      fields: this.options.loadEntOptions.fields,
      clause: AndOptional(this.clause, options.clause),
      orderby: getOrderBy(this.getSortCol(), options?.orderby),
      limit: options?.limit || DefaultLimit,
      context: this.viewer.context,
    });

    this.edges.set(1, rows);
  }

  dataToID(edge: Data): ID {
    return edge.id;
  }

  protected async loadEntsFromEdges(id: ID, rows: Data[]): Promise<TDest[]> {
    return applyPrivacyPolicyForRows(
      this.viewer,
      rows,
      this.options.loadEntOptions,
    );
  }
}
