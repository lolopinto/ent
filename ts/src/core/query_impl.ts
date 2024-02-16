import { QueryableDataOptions } from "./base";

export interface OrderByOption {
  column: string;
  direction: "ASC" | "DESC";
  alias?: string;
  nullsPlacement?: "first" | "last";
  // is this column a date/time column?
  // needed to know if we create a cursor based on this column to conver to timestamp and ISO string for
  // comparison
  // maybe eventually want a more generic version of this but for now this suffices
  dateColumn?: boolean;
}

export type OrderBy = OrderByOption[];

export function getOrderByPhrase(orderby: OrderBy, alias?: string): string {
  return orderby
    .map((v) => {
      let nullsPlacement = "";
      switch (v.nullsPlacement) {
        case "first":
          nullsPlacement = " NULLS FIRST";
          break;
        case "last":
          nullsPlacement = " NULLS LAST";
          break;
      }
      const orderByAlias = v.alias ?? alias;
      const col = orderByAlias ? `${orderByAlias}.${v.column}` : v.column;
      return `${col} ${v.direction}${nullsPlacement}`;
    })
    .join(", ");
}

export function reverseOrderBy(orderby: OrderBy): OrderBy {
  return orderby.map((o) => {
    const o2 = { ...o };
    o2.direction = o.direction === "ASC" ? "DESC" : "ASC";
    return o2;
  });
}

interface JoinInfo {
  phrase: string;
  valuesUsed: number;
}

export function getJoinInfo(
  join: NonNullable<QueryableDataOptions["join"]>,
  clauseIdx = 1,
): JoinInfo {
  let valuesUsed = 0;
  const str = join
    .map((join) => {
      const joinTable = join.alias
        ? `${join.tableName} ${join.alias}`
        : join.tableName;
      valuesUsed += join.clause.values().length;
      return `JOIN ${joinTable} ON ${join.clause.clause(clauseIdx)}`;
    })
    .join(" ");
  return {
    phrase: str,
    valuesUsed,
  };
}

export function buildQuery(options: QueryableDataOptions): string {
  const fieldsAlias = options.fieldsAlias ?? options.alias;
  const fields = options.fields
    .map((f) => {
      if (typeof f === "object") {
        if (!options.disableFieldsAlias) {
          return `${f.alias}.${f.column}`;
        }
        return f.column;
      }
      if (fieldsAlias && !options.disableFieldsAlias) {
        return `${fieldsAlias}.${f}`;
      }
      return f;
    })
    .join(", ");

  // always start at 1
  const parts: string[] = [];
  const tableName = options.alias
    ? `${options.tableName} AS ${options.alias}`
    : options.tableName;
  if (options.distinct) {
    parts.push(`SELECT DISTINCT ${fields} FROM ${tableName}`);
  } else {
    parts.push(`SELECT ${fields} FROM ${tableName}`);
  }

  let whereStart = 1;
  if (options.join) {
    const { phrase, valuesUsed } = getJoinInfo(options.join);
    parts.push(phrase);
    whereStart += valuesUsed;
  }

  parts.push(`WHERE ${options.clause.clause(whereStart, options.alias)}`);
  if (options.groupby) {
    parts.push(`GROUP BY ${options.groupby}`);
  }
  if (options.orderby) {
    parts.push(
      `ORDER BY ${getOrderByPhrase(
        options.orderby,
        options.disableDefaultOrderByAlias ? undefined : fieldsAlias,
      )}`,
    );
  }
  if (options.limit) {
    parts.push(`LIMIT ${options.limit}`);
  }
  return parts.join(" ");
}
