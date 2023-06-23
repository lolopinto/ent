interface OrderByOptions {
  column: string;
  direction: "asc" | "desc";
  nullsPlacement?: "first" | "last";
}

export type OrderBy = string | OrderByOptions[];

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
