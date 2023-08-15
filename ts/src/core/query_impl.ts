import { QueryableDataOptions } from "./base";

export interface OrderByOption {
  column: string;
  direction: "ASC" | "DESC";
  nullsPlacement?: "first" | "last";
}

export type OrderBy = OrderByOption[];

export function getOrderByPhrase(orderby: OrderBy): string {
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
      return `${v.column} ${v.direction}${nullsPlacement}`;
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

export function buildQuery(options: QueryableDataOptions): string {
  const fields = options.fields.join(", ");
  // always start at 1
  const whereClause = options.clause.clause(1);
  const parts: string[] = [];
  parts.push(`SELECT ${fields} FROM ${options.tableName} WHERE ${whereClause}`);
  if (options.groupby) {
    parts.push(`GROUP BY ${options.groupby}`);
  }
  if (options.orderby) {
    parts.push(`ORDER BY ${getOrderByPhrase(options.orderby)}`);
  }
  if (options.limit) {
    parts.push(`LIMIT ${options.limit}`);
  }
  return parts.join(" ");
}
