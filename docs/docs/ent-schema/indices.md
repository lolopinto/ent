---
sidebar_position: 9
---

# Indices
This allows configuring indices in the database.

The easiest way to add an index on a single column is to use the [index modifier](http://localhost:3000/docs/ent-schema/fields#index) on the field.

For example, if we're querying a lot on the price of items, we can add a multi-column index as follows:

```ts title="src/schema/product_item.ts"
import { Field, FloatType, BaseEntSchema, Constraint, Index, ConstraintType } from "@lolopinto/ent";

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

```db
ent-test=# \d+ product_items
                                             Table "public.product_items"
     Column     |            Type             | Collation | Nullable | Default | Storage | Stats target | Description 
----------------+-----------------------------+-----------+----------+---------+---------+--------------+-------------
 id             | uuid                        |           | not null |         | plain   |              | 
 created_at     | timestamp without time zone |           | not null |         | plain   |              | 
 updated_at     | timestamp without time zone |           | not null |         | plain   |              | 
 price          | double precision            |           | not null |         | plain   |              | 
 discount_price | double precision            |           | not null |         | plain   |              | 
Indexes:
    "product_items_id_pkey" PRIMARY KEY, btree (id)
    "product_items_idx" btree (price, discount_price)
```