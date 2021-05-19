---
sidebar_position: 1
---

# Ent Intro

The `Ent` framework was created to free up time for engineers and teams to focus on what's different about their app as opposed to spending time rebuilding the same cruft that's common across different projects.

This is done by providing a balance of code generation in the API + ways to customize things as needed to integrate nicely with the generated code.

## Getting Started

The easiest way to get started is by using the template from the `ent-starter` [repository](https://github.com/lolopinto/ent-starter).

This requires the following:
* a local [PostgresQL](https://www.postgresql.org/download/) instance installed 
* a database created via `createdb database-name`
* [Docker](https://docs.docker.com/get-docker/) installed.

## Your first schema

After setting the environment up, make your first change by specifying a schema as follows:

```ts title="src/schema/user.ts"
import { BaseEntSchema, Field, StringType } from "@lolopinto/ent";
import { EmailType } from "@lolopinto/ent-email";
import { PasswordType } from "@lolopinto/ent-password";

export default class User extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    EmailType({ name: "EmailAddress" }),
    PasswordType({ name: "Password" }),
  ];
}
```

This does a few things:
* It specifies a new node in the schema called `User`.
* It adds 4 explicitly listed fields here: `FirstName`, `LastName`, `EmailAddress`, `Password` 
* and 3 implicitly listed by virtue of extending `BaseEntSchema`: `id`, `createdAt`, `updatedAt`.
* `FirstName` and `LastName` are strings. 
* `EmailAddress` is of type `email` and will be [parsed](https://www.npmjs.com/package/email-addresses) to be a "valid" email address before storing in the database. 
* `Password` is of type `password` and hashed and salted using [`bcrypt`](https://www.npmjs.com/package/bcryptjs) before storing in the database.
* The implicit fields are exactly what you'd expect. The default `id` provided by the framework is of type `uuid`.

Ensure `npm install` has been run to add the dependencies needed then run `npm run codegen` to generate the code.

List of generated files:

```
	new file:   src/ent/const.ts
	new file:   src/ent/generated/user_base.ts
	new file:   src/ent/index.ts
	new file:   src/ent/internal.ts
	new file:   src/ent/loadAny.ts
	new file:   src/ent/user.ts
	new file:   src/graphql/index.ts
	new file:   src/graphql/resolvers/generated/node_query_type.ts
	new file:   src/graphql/resolvers/generated/query_type.ts
	new file:   src/graphql/resolvers/generated/user_type.ts
	new file:   src/graphql/resolvers/index.ts
	new file:   src/graphql/resolvers/internal.ts
	new file:   src/graphql/schema.gql
	new file:   src/graphql/schema.ts
	new file:   src/schema/schema.py
	new file:   src/schema/versions/e3b78fe1bfa3_2021518203057_add_users_table.py
```

Let's go over a few: 
* `src/ent/user.ts` is the public facing API of the `User` object and what's consumed. It's also where **custom code** can be added.
* `src/ent/generated/user_base.ts` is the base class for the `User` where more generated code will be added as the schema is changed over time.
* `src/schema/versions/*_add_users_tabl.py` is the generated database migration to add the `users` table
* `src/graphql` is where all the generated `GraphQL` files are with the `GraphQL` schema file being:

```gql title="src/graphql/schema.gql"
type User implements Node {
  id: ID!
  firstName: String!
  lastName: String!
  emailAddress: String!
}

"""node interface"""
interface Node {
  id: ID!
}

type Query {
  node(id: ID!): Node
}
```

After running, 
```shell
npm run compile && npm run start
```

we have a simple GraphQL server.

Note that the database was also updated by the command run above:
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

ent-test=# 
```

## Editing the schema
To support writes, update the schema as follows:

```ts title="src/schema/user.ts"
import { BaseEntSchema, Field, StringType, Action, ActionOperation } from "@lolopinto/ent/schema";
import { EmailType } from "@lolopinto/ent-email";
import { PasswordType } from "@lolopinto/ent-password";

export default class User extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    EmailType({ name: "EmailAddress" }),
    PasswordType({ name: "Password" }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Create,
    }
  ];
}
```

re-run ```npm run codegen```

which leads to the following changed files:

```
  new file:   src/ent/user/actions/create_user_action.ts
	new file:   src/ent/user/actions/generated/create_user_action_base.ts
	new file:   src/ent/user/actions/user_builder.ts
	new file:   src/graphql/mutations/generated/mutation_type.ts
	new file:   src/graphql/mutations/generated/user/user_create_type.ts
	modified:   src/graphql/schema.gql
	modified:   src/graphql/schema.ts
	modified:   src/schema/user.ts
```

and the GraphQL schema updated as follows:
```gql title="src/graphql/schema.gql"
type Query {
  node(id: ID!): Node
}

"""node interface"""
interface Node {
  id: ID!
}

type Mutation {
  userCreate(input: UserCreateInput!): UserCreatePayload!
}

type UserCreatePayload {
  user: User!
}

type User implements Node {
  id: ID!
  firstName: String!
  lastName: String!
  emailAddress: String!
}

input UserCreateInput {
  firstName: String!
  lastName: String!
  emailAddress: String!
}
```

That's a quick introduction to what's supported here. We'll dive deeper into these concepts in the following sections.

