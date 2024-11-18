import {
  Data,
  EdgeQueryableDataOptions,
  Ent,
  ID,
  LoadEntOptions,
  QueryDataOptions,
  SelectBaseDataOptions,
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

import { BaseEdgeQuery, IDInfo } from "./query";

export interface CustomClauseQueryOptions<
  TDest extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
  TSource extends Ent<TViewer> | undefined = undefined,
> {
  loadEntOptions: LoadEntOptions<TDest, TViewer>;

  source?: TSource;
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

  joinBETA?: QueryDataOptions["join"];
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
  TSource extends Ent<TViewer> | undefined = undefined,
> extends BaseEdgeQuery<any, TDest, Data> {
  private clause: Clause;
  private source?: TSource;

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
      joinBETA: options.joinBETA,
      fieldOptions: options.loadEntOptions,
    });
    this.clause = getClause(options);
    this.source = options.source;
  }

  __maybeSetSource(src: TSource) {
    if (this.source && this.source !== src) {
      console.warn("source already set to something else");
    } else {
      this.source = src;
    }
  }

  async sourceEnt(_id: ID) {
    // The sourceEnt is used for privacy checks and if we have the source we already know
    // the privacy checks have been done or will be done
    // This is being set for completeness but we don't really care about this.

    // See https://github.com/lolopinto/ent/blob/15af0165f83458acc1d1c9f934f4534dca6154ff/ts/src/core/query/query.ts#L729-L739 for how sourceEnt is
    // used in the codebase
    return this.source ?? null;
  }

  getTableName() {
    return this.options.loadEntOptions.tableName;
  }

  async queryRawCount(): Promise<number> {
    // sqlite needs as count otherwise it returns count(1)
    let fields: SelectBaseDataOptions["fields"] = ["count(1) as count"];
    if (this.options.joinBETA) {
      const firstRequestedField = this.options.loadEntOptions.fields[0];
      const alias =
        this.options.loadEntOptions.fieldsAlias ??
        this.options.loadEntOptions.alias;
      const fieldString =
        typeof firstRequestedField === "object"
          ? `${firstRequestedField.alias}.${firstRequestedField.column}`
          : alias
            ? `${alias}.${firstRequestedField}`
            : firstRequestedField;
      fields = [`count(distinct ${fieldString}) as count`];
    }
    const row = await loadRow({
      ...this.options.loadEntOptions,
      tableName: this.options.loadEntOptions.tableName,
      fields,
      clause: this.clause,
      context: this.viewer.context,
      join: this.options.joinBETA,
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
          column: this.getCursorCol(),
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
      join: this.options.joinBETA,
      // if doing a join, select distinct rows
      distinct: this.options.joinBETA !== undefined,
    });

    if (this.source) {
      this.edges.set(this.source.id, rows);
    } else {
      this.edges.set(1, rows);
    }
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
