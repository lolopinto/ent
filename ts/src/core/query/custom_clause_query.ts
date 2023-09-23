import {
  Data,
  EdgeQueryableDataOptions,
  Ent,
  ID,
  LoadEntOptions,
  QueryDataOptions,
  Viewer,
} from "../base";
import { AndOptional, Clause } from "../clause";
import {
  applyPrivacyPolicyForRows,
  getDefaultLimit,
  loadRow,
  loadRows,
} from "../ent";
import { OrderBy } from "../query_impl";

import { BaseEdgeQuery, EdgeQueryOptions, IDInfo } from "./query";

export interface CustomClauseQueryOptions<
  TDest extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
> {
  loadEntOptions: LoadEntOptions<TDest, TViewer>;
  clause: Clause;
  // query-name used to create loaders...
  // and then from there it does what it needs to do to do the right thing...
  name: string;
  // pass this if the primary sort (first column in orderby) column is unique and it'll be used for the cursor and used to
  // generate the query
  primarySortColIsUnique?: boolean;
  orderby?: OrderBy;

  // these next 3 are deprecated. use orderby
  // defaults to id
  // @deprecated use orderby
  sortColumn?: string;
  // @deprecated use orderby
  orderByDirection?: "ASC" | "DESC";
  // in Postgres, NULLS FIRST is the default for DESC order, and NULLS LAST otherwise.
  // @deprecated user orderby`
  nullsPlacement?: "first" | "last";

  disableTransformations?: boolean;

  join?: QueryDataOptions["join"];
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
    let orderby: OrderBy;
    let primarySortCol: string;

    if (
      options.orderby &&
      (options.sortColumn || options.orderByDirection || options.nullsPlacement)
    ) {
      throw new Error(
        `cannot pass orderby and sortColumn|orderByDirection|nullsPlacement`,
      );
    }
    if (options.orderby) {
      primarySortCol = options.orderby[0].column;
      orderby = options.orderby;
    } else {
      primarySortCol = options.sortColumn || "id";
      orderby = [
        {
          column: primarySortCol,
          direction: options.orderByDirection ?? "DESC",
          nullsPlacement: options.nullsPlacement,
        },
      ];
    }
    let cursorCol = options.primarySortColIsUnique
      ? primarySortCol
      : options.loadEntOptions.loaderFactory.options?.key || "id";

    super(viewer, {
      orderby,
      cursorCol,
      join: options.join,
      fieldOptions: options.loadEntOptions,
    });
    this.clause = getClause(options);
  }

  async sourceEnt(_id: ID) {
    return null;
  }

  getTableName() {
    return this.options.loadEntOptions.tableName;
  }

  protected includeSortColInCursor(options: EdgeQueryOptions) {
    // TODO maybe we should just always do this?
    return options.join !== undefined && this.sortCol !== this.cursorCol;
  }

  async queryRawCount(): Promise<number> {
    // sqlite needs as count otherwise it returns count(1)
    let fields = ["count(1) as count"];
    if (this.options.join) {
      const requestedFields = this.options.loadEntOptions.fields;
      const alias =
        this.options.loadEntOptions.fieldsAlias ??
        this.options.loadEntOptions.alias;
      if (alias) {
        fields = [`count(distinct ${alias}.${requestedFields[0]}) as count`];
      } else {
        fields = [`count(distinct ${requestedFields[0]}) as count`];
      }
    }
    const row = await loadRow({
      ...this.options.loadEntOptions,
      tableName: this.options.loadEntOptions.tableName,
      fields,
      clause: this.clause,
      context: this.viewer.context,
      join: this.options.join,
      disableFieldsAlias: true,
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
      options.orderby = [
        {
          column: this.getSortCol(),
          direction: this.options.orderByDirection ?? "DESC",
          nullsPlacement: this.options.nullsPlacement,
        },
      ];
    }
    if (!options.limit) {
      options.limit = getDefaultLimit();
    }

    const rows = await loadRows({
      ...this.options.loadEntOptions,
      clause: AndOptional(this.clause, options.clause),
      orderby: options.orderby,
      limit: options?.limit || getDefaultLimit(),
      context: this.viewer.context,
      join: this.options.join,
      // if doing a join, select distinct rows
      distinct: this.options.join !== undefined,
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

  __getOptions() {
    return this.options;
  }
}
