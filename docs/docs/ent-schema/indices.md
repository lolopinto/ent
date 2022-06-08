---
sidebar_position: 9
---

# Indices

This allows configuring indices in the database.

The easiest way to add an index on a single column is to use the [index modifier](/docs/ent-schema/fields#index) on the field.

However, to add a multi-column index if we're querying a lot on the price of items:

```ts title="src/schema/product_item_schema.ts"
import {  FloatType, EntSchema } from "@snowtop/ent"; 

const ProductItemSchema = new EntSchema({
  fields: {
    price: FloatType(),
    discount_price: FloatType(),
  }, 

  indices: [
    {
      name: "product_items_idx",
      columns: ["price", "discount_price"],
    },
  ], 
}); 
export default ProductItemSchema; 
```

which leads to

import DatabaseTabs from "../../src/components/DatabaseTabs";
import PostgresIndices from "./postgres_indices.txt";
import SqliteIndices from "./sqlite_indices.txt";

<DatabaseTabs postgres={PostgresIndices} sqlite={SqliteIndices} />
