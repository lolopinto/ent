---
sidebar_position: 9
---

# Indices

This allows configuring indices in the database.

The easiest way to add an index on a single column is to use the [index modifier](/docs/ent-schema/fields#index) on the field.

For example, if we're querying a lot on the price of items, we can add a multi-column index as follows:

```ts title="src/schema/product_item.ts"
import { Field, FloatType, BaseEntSchema, Constraint, Index, ConstraintType } from "@snowtop/ent";

export default class ProductItem extends BaseEntSchema {
  fields: Field[] = [
    FloatType({
      name: 'price',
    }),
    FloatType({
      name: 'discount_price',
    }),
  ];

  indices: Index[] = [
    {
      name: "product_items_idx",
      columns: ["price", "discount_price"],
    },
  ];
}
```

which leads to

import DatabaseTabs from "../../src/components/DatabaseTabs";
import PostgresIndices from "./postgres_indices.txt";
import SqliteIndices from "./sqlite_indices.txt";

<DatabaseTabs postgres={PostgresIndices} sqlite={SqliteIndices} />
