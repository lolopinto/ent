---
sidebar_position: 8
---

# Constraints
This allows configuring constraints in the database

## unique constraint
The easiest way to add a unique constraint on a single column is to use the [unique modifier](http://localhost:3000/docs/ent-schema/fields#unique) on the field.

However, to add a multi-column constraint:
```ts title="src/schema/guest.ts"
export default class Guest extends BaseEntSchema {
  fields: Field[] = [
    UUIDType({
      name: "eventID",
      foreignKey: { schema: "Event", column: "ID" },
    }),
    EmailType({ name: "EmailAddress", nullable: true }),
  ];

  constraints: Constraint[] = [
    {
      name: "uniqueEmail",
      type: ConstraintType.Unique,
      columns: ["eventID", "EmailAddress"],
    },
  ];
}
```
leads to database change
```db
ent-rsvp=# \d+ guests
                                                 Table "public.guests"
     Column     |            Type             | Collation | Nullable | Default | Storage  | Stats target | Description 
----------------+-----------------------------+-----------+----------+---------+----------+--------------+-------------
 id             | uuid                        |           | not null |         | plain    |              | 
 created_at     | timestamp without time zone |           | not null |         | plain    |              | 
 updated_at     | timestamp without time zone |           | not null |         | plain    |              | 
 email_address  | text                        |           |          |         | extended |              | 
 event_id       | uuid                        |           | not null |         | plain    |              | 
Indexes:
    "guests_id_pkey" PRIMARY KEY, btree (id)
    "uniqueEmail" UNIQUE CONSTRAINT, btree (event_id, email_address)
    "guests_event_id_idx" btree (event_id)
Foreign-key constraints:
    "guests_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
ent-rsvp=# 
```

## primary key constraint
The easiest way to add a unique constraint on a single column is to use the [primaryKey modifier](http://localhost:3000/docs/ent-schema/fields#primarykey) on the field.

To add a multi-column constraint:
```ts title="src/schema/user_photo.ts"
import { Schema, Field, UUIDType, Constraint, ConstraintType } from "@snowtop/ent";

export default class UserPhoto implements Schema {
  fields: Field[] = [
    UUIDType({
      name: 'UserID',
    }),
    UUIDType({
      name: 'PhotoID',
    }),
  ];

  constraints: Constraint[] = [
    {
      name: "user_photos_pkey",
      type: ConstraintType.PrimaryKey,
      columns: ["UserID", "PhotoID"],
    },
  ];
}
```
leads to database change:
```db
ent-test=# \d+ user_photos
                               Table "public.user_photos"
  Column  | Type | Collation | Nullable | Default | Storage | Stats target | Description 
----------+------+-----------+----------+---------+---------+--------------+-------------
 user_id  | uuid |           | not null |         | plain   |              | 
 photo_id | uuid |           | not null |         | plain   |              | 
Indexes:
    "user_photos_pkey" PRIMARY KEY, btree (user_id, photo_id)
```

TODO: Currently, there's an issue here that needs to be fixed: https://github.com/lolopinto/ent/issues/328


## foreign key constraint
The easiest way to add a foreign key constraint on a single column is to use the [foreignKey modifier](http://localhost:3000/docs/ent-schema/fields#foreignkey) on the field.

The columns being referenced on the other table need to be unique either via a multi-column unique constraint or primary key.

In this contrived example with the following schema,
```ts title="src/schema/user.ts"
import { BaseEntSchema, Field, StringType, Pattern, Action, ActionOperation, TimestampType, Node, Constraint, ConstraintType } from "@snowtop/ent/schema";
import { EmailType } from "@snowtop/ent-email";
import { PasswordType } from "@snowtop/ent-password";

export default class User extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    EmailType({ name: "EmailAddress" }),
    PasswordType({ name: "Password" }),
  ];

  constraints: Constraint[] = [
    {
      name: "user_uniqueEmail",
      type: ConstraintType.Unique,
      columns: ["ID", "EmailAddress"],
    },
  ];
}
```

```ts title="src/schema/contact.ts"
import { BaseEntSchema, Field, UUIDType, StringType, Constraint, ConstraintType } from "@snowtop/ent";

export default class Contact extends BaseEntSchema {
  fields: Field[] = [
    StringType({
      name: "emailAddress",
    }),
    UUIDType({
      name: "userID",
    }),
  ];

  constraints: Constraint[] = [
    {
      name: "contacts_user_fkey",
      type: ConstraintType.ForeignKey,
      columns: ["userID", "emailAddress"],
      fkey: {
        tableName: "users",
        ondelete: "CASCADE",
        columns: ["ID", "EmailAddress"],
      }
    },
  ];
}
```

leads to

```db
ent-test=# \d+ users
                                                 Table "public.users"
    Column     |            Type             | Collation | Nullable | Default | Storage  | Stats target | Description 
---------------+-----------------------------+-----------+----------+---------+----------+--------------+-------------
 id            | uuid                        |           | not null |         | plain    |              | 
 created_at    | timestamp without time zone |           | not null |         | plain    |              | 
 updated_at    | timestamp without time zone |           | not null |         | plain    |              | 
 first_name    | text                        |           | not null |         | extended |              | 
 last_name     | text                        |           | not null |         | extended |              | 
 email_address | text                        |           | not null |         | extended |              | 
 password      | text                        |           | not null |         | extended |              | 
Indexes:
    "users_id_pkey" PRIMARY KEY, btree (id)
    "user_uniqueEmail" UNIQUE CONSTRAINT, btree (id, email_address)
Referenced by:
    TABLE "contacts" CONSTRAINT "contacts_user_fkey" FOREIGN KEY (user_id, email_address) REFERENCES users(id, email_address) ON DELETE CASCADE

ent-test=# 
```
```db
ent-test=# \d+ contacts
                                               Table "public.contacts"
    Column     |            Type             | Collation | Nullable | Default | Storage  | Stats target | Description 
---------------+-----------------------------+-----------+----------+---------+----------+--------------+-------------
 id            | uuid                        |           | not null |         | plain    |              | 
 created_at    | timestamp without time zone |           | not null |         | plain    |              | 
 updated_at    | timestamp without time zone |           | not null |         | plain    |              | 
 email_address | text                        |           | not null |         | extended |              | 
 user_id       | uuid                        |           | not null |         | plain    |              | 
Indexes:
    "contacts_id_pkey" PRIMARY KEY, btree (id)
Foreign-key constraints:
    "contacts_user_fkey" FOREIGN KEY (user_id, email_address) REFERENCES users(id, email_address) ON DELETE CASCADE
```


## check constraint
adds a [check constraint](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-CHECK-CONSTRAINTS) to the schema.

For example,
```ts title="src/schema/item.ts"
import { Field, FloatType, BaseEntSchema, Constraint, ConstraintType } from "@snowtop/ent";

export default class Item extends BaseEntSchema {
  fields: Field[] = [
    FloatType({
      name: 'price',
    }),
  ];

  constraints: Constraint[] = [
    {
      name: "item_positive_price",
      type: ConstraintType.Check,
      condition: 'price > 0',
      columns: [],
    },
  ];
}
```

leads to 
```db
ent-test=# \d+ items
                                               Table "public.items"
   Column   |            Type             | Collation | Nullable | Default | Storage | Stats target | Description 
------------+-----------------------------+-----------+----------+---------+---------+--------------+-------------
 id         | uuid                        |           | not null |         | plain   |              | 
 created_at | timestamp without time zone |           | not null |         | plain   |              | 
 updated_at | timestamp without time zone |           | not null |         | plain   |              | 
 price      | double precision            |           | not null |         | plain   |              | 
Indexes:
    "items_id_pkey" PRIMARY KEY, btree (id)
Check constraints:
    "item_positive_price" CHECK (price > 0::double precision)

ent-test=# 
```

or for something more complicated
```ts title="src/schema/product_item.ts"
import { Field, FloatType, BaseEntSchema, Constraint, ConstraintType } from "@snowtop/ent";

export default class ProductItem extends BaseEntSchema {
  fields: Field[] = [
    FloatType({
      name: 'price',
    }),
    FloatType({
      name: 'discount_price',
    }),
  ];

  constraints: Constraint[] = [
    {
      name: "item_positive_price",
      type: ConstraintType.Check,
      condition: 'price > 0',
      columns: [],
    },
    {
      name: "item_positive_discount_price",
      type: ConstraintType.Check,
      condition: 'discount_price > 0',
      columns: [],
    },
    {
      name: "item_price_greater_than_discount",
      type: ConstraintType.Check,
      condition: 'price > discount_price',
      columns: [],
    },
  ];
}
```
leads to 
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
Check constraints:
    "item_positive_discount_price" CHECK (discount_price > 0::double precision)
    "item_positive_price" CHECK (price > 0::double precision)
    "item_price_greater_than_discount" CHECK (price > discount_price)

```

## options

### name
name of the constraint

### type
constraint type. currently supported:
* [ConstraintType.PrimaryKey](#primary-key-constraint)
* [ConstraintType.ForeignKey](#foreign-key-constraint)
* [ConstraintType.Unique](#unique-constraint)
* [ConstraintType.Check](#check-constraint)

### columns
list of columns constraint applies to. At least 1 column required for primary key, foreign key and unique constraints

### fkey
configures the foreignKey constraint. [See above](#foreign-key-constraint).

`ondelete` options are: `RESTRICT`, `CASCADE`, `SET NULL`, `SET DEFAULT`, `NO ACTION`.

### condition
condition that resolves to a boolean that should be added to a check constraint.
