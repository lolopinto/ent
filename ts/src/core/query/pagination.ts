import {
  Data,
  EdgeQueryableDataOptions,
  QueryableDataOptions,
  SelectBaseDataOptions,
} from "../base";
import * as clause from "../clause";
import { decodeCursorPayload, getCursor } from "../ent";
import { OrderBy, orderByHasExpressions, reverseOrderBy } from "../query_impl";

// A filter over one result list. Source grouping belongs to BaseEdgeQuery.
export interface RowQueryFilter<T extends Data> {
  fetch?(): Promise<void>;
  filter?(rows: T[]): T[];
  query?(
    options: EdgeQueryableDataOptions,
  ): EdgeQueryableDataOptions | Promise<EdgeQueryableDataOptions>;
  paginationInfo?(): PaginationInfo | undefined;
}

export function emptyPaginationInfo(): PaginationInfo {
  return {
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor: "",
    endCursor: "",
  };
}

export interface PaginationInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string;
  endCursor: string;
}

// TODO can we generalize EdgeQuery to support any clause
function assertPositive(n: number) {
  if (n < 0) {
    throw new Error("cannot use a negative number");
  }
}

interface validCursorOptions {
  keys: string[];
}

export type CursorKeyValues = [key: string, value: string | number | null][];

function translateCursorToKeyValues(
  cursor: string,
  opts: validCursorOptions,
): CursorKeyValues {
  const { keys } = opts;
  const decoded = decodeCursorPayload(cursor);
  let cursorData: CursorKeyValues = [];
  try {
    cursorData = JSON.parse(decoded);
  } catch (error) {
    throw new Error(`Bad cursor format ${cursor} passed`);
  }
  // invalid or unknown cursor. nothing to do here.
  // we should have the same number of parts as keys
  if (cursorData.length !== keys.length) {
    throw new Error(`invalid cursor ${cursor} passed`);
  }
  return cursorData;
}

interface FilterOptions<T extends Data> {
  limit: number;
  query: { getCursor(row: T): string };
  cursorCol: string;
  orderby: OrderBy;

  cursorKeys: string[];

  // fieldOptions used to query field values
  // used for alias
  fieldOptions?: SelectBaseDataOptions;
}

interface FirstFilterOptions<T extends Data> extends FilterOptions<T> {
  after?: string;
}

interface LastFilterOptions<T extends Data> extends FilterOptions<T> {
  before?: string;
}

class FirstFilter<T extends Data> implements RowQueryFilter<T> {
  /**
   * The offset is the value of the last key in the cursor, which is the primary key for the table
   */
  private offset: string | number | undefined;
  private edgeQuery: { getCursor(row: T): string };
  private pageInfo?: PaginationInfo;
  private usedQuery = false;
  private cursorKeyValues: CursorKeyValues = [];

  constructor(private options: FirstFilterOptions<T>) {
    assertPositive(options.limit);

    if (options.after) {
      this.cursorKeyValues = translateCursorToKeyValues(options.after, {
        keys: options.cursorKeys,
      });
      this.offset =
        this.cursorKeyValues[this.cursorKeyValues.length - 1][1] ?? undefined;
    }
    this.edgeQuery = options.query;
  }

  private setPageInfo(ret: T[], hasNextPage: boolean) {
    this.pageInfo = {
      hasNextPage,
      // hasPreviousPage always false even if there's a previous page because
      // we shouldn't be querying in both directions at the same
      hasPreviousPage: false,
      startCursor: this.edgeQuery.getCursor(ret[0]),
      endCursor: this.edgeQuery.getCursor(ret[ret.length - 1]),
    };
  }

  filter(edges: T[]): T[] {
    this.pageInfo = undefined;
    if (edges.length > this.options.limit) {
      //  we need a way to know where the cursor is and if we used it and if not need to do this in TypeScript and not in SQL
      // so can't filter from 0 but specific item

      // if we used the query or we're querying the first N, slice from 0
      if (this.usedQuery || !this.offset) {
        const ret = edges.slice(0, this.options.limit);
        this.setPageInfo(ret, true);
        return ret;
      } else if (this.offset) {
        const ret: T[] = [];
        let found = false;
        let i = 0;
        let hasNextPage = false;
        for (const edge of edges) {
          const id = edge[this.options.cursorCol];
          if (id === this.offset) {
            // found!
            found = true;
            hasNextPage = true;
            continue;
          }
          if (found) {
            ret.push(edge);
            if (ret.length === this.options.limit) {
              if (i === ret.length - 1) {
                hasNextPage = false;
              }
              break;
            }
          }
          i++;
        }
        if (hasNextPage && ret.length < this.options.limit) {
          hasNextPage = false;
        }
        if (ret.length) {
          this.setPageInfo(ret, hasNextPage);
        }
        return ret;
      }
    }
    // TODO: in the future, when we have caching for edges
    // we'll want to hit that cache instead of passing the limit down to the
    // SQL query so we'll need a way to indicate whether this is done in SQL or not
    // and then the slice will always happen
    // so we'd need a way to indicate whether this is done in sql or not
    return edges;
  }

  async query(
    options: EdgeQueryableDataOptions,
  ): Promise<EdgeQueryableDataOptions> {
    this.usedQuery = true;

    // we fetch an extra one to see if we're at the end
    options.limit = this.options.limit + 1;

    const orderBy = this.options.orderby;

    if (this.offset) {
      if (orderByHasExpressions(orderBy)) {
        throw new Error(
          "cursor pagination does not support computed order expressions",
        );
      }
      const keyValuePairs: { [key: string]: string | number | null } = {};
      for (const [key, value] of this.cursorKeyValues) {
        keyValuePairs[key] = value;
      }
      options.clause = clause.AndOptional(
        options.clause,
        clause.PaginationUnboundColsQuery(
          orderBy.map((orderBy) => ({
            sortCol: orderBy.column,
            sortValue: keyValuePairs[orderBy.column],
            direction: orderBy.direction,
            nullsPlacement: orderBy.nullsPlacement,
            overrideAlias: orderBy.alias,
          })),
        ),
      );
    }

    options.orderby = orderBy;
    return options;
  }

  // TODO?
  paginationInfo(): PaginationInfo | undefined {
    return this.pageInfo;
  }
}

// TODO LastFilter same behavior as FirstFilter
// TODO can we share so we don't keep needing to change in both
class LastFilter<T extends Data> implements RowQueryFilter<T> {
  /**
   * The offset is the value of the last key in the cursor, which is the primary key for the table
   */
  private offset: string | number | undefined;
  private pageInfo?: PaginationInfo;
  private edgeQuery: { getCursor(row: T): string };
  private cursorKeyValues: CursorKeyValues = [];

  constructor(private options: LastFilterOptions<T>) {
    assertPositive(options.limit);

    if (options.before) {
      this.cursorKeyValues = translateCursorToKeyValues(options.before, {
        keys: options.cursorKeys,
      });
      this.offset =
        this.cursorKeyValues[this.cursorKeyValues.length - 1][1] ?? undefined;
    }
    this.edgeQuery = options.query;
  }

  filter(edges: T[]): T[] {
    this.pageInfo = undefined;
    let ret: T[] = [];
    if (this.offset) {
      // we have an extra one, get rid of it. we only got it to see if hasPreviousPage = true
      if (edges.length > this.options.limit) {
        ret = edges.slice(0, edges.length - 1);
      } else {
        // done in SQL. nothing to do here.
        ret = edges;
      }
    } else {
      ret = edges.slice(0, this.options.limit);
    }

    if (edges.length > this.options.limit) {
      this.pageInfo = {
        hasPreviousPage: true,
        // hasNextPage always false even if there's a next page because
        // we shouldn't be querying in both directions at the same
        hasNextPage: false,
        startCursor: this.edgeQuery.getCursor(ret[0]),
        endCursor: this.edgeQuery.getCursor(ret[ret.length - 1]),
      };
    }
    return ret;
  }

  async query(
    options: EdgeQueryableDataOptions,
  ): Promise<EdgeQueryableDataOptions> {
    // we fetch an extra one to see if we're at the end
    options.limit = this.options.limit + 1;

    // we also sort cursor col in same direction. (direction doesn't matter)
    const orderBy = reverseOrderBy(this.options.orderby);

    if (this.offset) {
      if (orderByHasExpressions(orderBy)) {
        throw new Error(
          "cursor pagination does not support computed order expressions",
        );
      }
      const keyValuePairs: { [key: string]: string | number | null } = {};
      for (const [key, value] of this.cursorKeyValues) {
        keyValuePairs[key] = value;
      }
      options.clause = clause.AndOptional(
        options.clause,
        clause.PaginationUnboundColsQuery(
          orderBy.map((orderBy) => ({
            sortCol: orderBy.column,
            sortValue: keyValuePairs[orderBy.column],
            direction: orderBy.direction,
            nullsPlacement: orderBy.nullsPlacement,
            overrideAlias: orderBy.alias,
          })),
        ),
      );
    }
    options.orderby = orderBy;

    return options;
  }

  paginationInfo(): PaginationInfo | undefined {
    return this.pageInfo;
  }
}

export interface QueryPaginationOptions {
  cursorCol: string;
  cursorColIsDate?: boolean;
  orderby: OrderBy;
  joinBETA?: NonNullable<QueryableDataOptions["join"]>;
  // field options used to query field values
  fieldOptions?: SelectBaseDataOptions;
}

export class QueryPagination<T extends Data> {
  private options: QueryPaginationOptions;
  private cursorKeys: string[];

  constructor(
    options: QueryPaginationOptions,
    private readonly getPageCursor: (row: T) => string,
  ) {
    // we also sort cursor col in same direction. (direction doesn't matter)
    const orderBy = [...options.orderby];
    if (
      !options.orderby.some((orderBy) => orderBy.column === options.cursorCol)
    ) {
      orderBy.push({
        column: options.cursorCol,
        direction: orderBy?.[0].direction || "DESC",
      });
    }
    orderBy.forEach((o) => {
      o.alias =
        o.alias ??
        (options.fieldOptions?.disableFieldsAlias
          ? undefined
          : (options.fieldOptions?.fieldsAlias ?? options.fieldOptions?.alias));
    });
    this.options = { ...options, orderby: orderBy };
    this.cursorKeys = orderBy.map((orderBy) => orderBy.column);
  }

  first(limit: number, after?: string): RowQueryFilter<T> {
    return new FirstFilter({
      ...this.options,
      query: { getCursor: this.getPageCursor },
      cursorKeys: this.cursorKeys,
      limit,
      after,
    });
  }

  last(limit: number, before?: string): RowQueryFilter<T> {
    return new LastFilter({
      ...this.options,
      query: { getCursor: this.getPageCursor },
      cursorKeys: this.cursorKeys,
      limit,
      before,
    });
  }

  getCursor(row: T): string {
    return getCursor({ row, cursorKeys: this.cursorKeys });
  }
}
