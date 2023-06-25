export interface OrderByOption {
  column: string;
  direction: "ASC" | "DESC";
  nullsPlacement?: "first" | "last";
}

export type OrderBy = string | OrderByOption[];

export function getOrderByPhrase(orderby: OrderBy): string {
  let ret = "";
  if (Array.isArray(orderby)) {
    ret = orderby
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
  } else {
    ret = orderby;
  }
  return ret;
}

export function reverseOrderBy(orderby: OrderByOption[]): OrderByOption[] {
  return orderby.map((o) => {
    const o2 = { ...o };
    o2.direction = o.direction === "ASC" ? "DESC" : "ASC";
    return o2;
  });
}
