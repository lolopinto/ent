import { QueryableDataOptions } from "./base";

export interface OrderByOption {
  column: string;
  direction: "ASC" | "DESC";
  nullsPlacement?: "first" | "last";
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
      const col = alias ? `${alias}.${v.column}` : v.column;
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

export function getJoinPhrase(
  join: NonNullable<QueryableDataOptions["join"]>,
  clauseIdx = 1,
): string {
  const joinTable = join.alias
    ? `${join.tableName} ${join.alias}`
    : join.tableName;
  return `${joinTable} ON ${join.clause.clause(clauseIdx)}`;
}

export function buildQuery(options: QueryableDataOptions): string {
  const fields = options.alias
    ? options.fields.map((f) => `${options.alias}.${f}`).join(", ")
    : options.fields.join(", ");

  // always start at 1
  const parts: string[] = [];
  const tableName = options.alias
    ? `${options.tableName} AS ${options.alias}`
    : options.tableName;
  parts.push(`SELECT ${fields} FROM ${tableName}`);

  let whereStart = 1;
  if (options.join) {
    parts.push(`JOIN ${getJoinPhrase(options.join, 1)}`);
    whereStart += options.join.clause.values().length;
  }

  parts.push(`WHERE ${options.clause.clause(whereStart, options.alias)}`);
  if (options.groupby) {
    parts.push(`GROUP BY ${options.groupby}`);
  }
  if (options.orderby) {
    parts.push(`ORDER BY ${getOrderByPhrase(options.orderby, options.alias)}`);
  }
  if (options.limit) {
    parts.push(`LIMIT ${options.limit}`);
  }
  return parts.join(" ");
}
