---
sidebar_position: 1
---

# Ent Intro

The `Ent` framework was created to free up time for engineers and teams to focus on what's different about their app as opposed to spending time rebuilding the same cruft that's common across different projects.

This is done by providing a balance of code generation + ways to customize things as needed to integrate nicely with the generated code.

It takes a holistic approach and uses the Schema generated to integrate with the following 3 core layers:
* database
* middle layer where most of the application logic lives
* GraphQL layer for exposing the data to clients.

It handles the following high level things:
* managing the database along with database migrations using [alembic](https://alembic.sqlalchemy.org/en/latest/)
* handles CRUD operations based on the application
* first class GraphQL support
* built in permissions across the stack
* ability to write code to integrate with the generated code
* and lots more

## Getting Started

The easiest way to get started is by using the template from the `ent-starter` [repository](https://github.com/lolopinto/ent-starter).

This requires the following:
* a local [PostgresQL](https://www.postgresql.org/download/) instance installed 
* a database created via `createdb ent-starter` (or replace with your own database name)
  - if a different database is used, make sure to update the `environment` in `docker-compose.dev.yml`
* [Docker](https://docs.docker.com/get-docker/) installed.

## Your first schema

In the root of your application, run to create the schema directory:
```shell
mkdir -p src/schema
```

After setting the environment up, make your first change by specifying a schema as follows:

```ts title="src/schema/user.ts"
import { BaseEntSchema, Field, StringType } from "@lolopinto/ent";
import { EmailType } from "@lolopinto/ent-email";
import { PasswordType } from "@lolopinto/ent-password";

export default class User extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    EmailType({ name: "EmailAddress", unique: true  }),
    PasswordType({ name: "Password" }),
  ];
}
```

This does a few things:
* It specifies a new node in the schema called `User`.
* It adds 4 explicitly listed fields here: `FirstName`, `LastName`, `EmailAddress`, `Password`.
* and 3 implicitly listed by virtue of extending `BaseEntSchema`: `id`, `createdAt`, `updatedAt`.
* `FirstName` and `LastName` are strings. 
* `EmailAddress` is of type `email` and will be [parsed](https://www.npmjs.com/package/email-addresses) to be a "valid" email address before storing in the database. 
* `EmailAddress` field is marked as unique so we don't have multiple users with the same email address.
* `Password` is of type `password` and hashed and salted using [`bcrypt`](https://www.npmjs.com/package/bcryptjs) before storing in the database.
* The implicit fields are exactly what you'd expect. The default `id` provided by the framework is of type `uuid`.

Then run the following commands:

```shell
# install additional dependencies
npm install @lolopinto/ent-email @lolopinto/ent-password
# install all the things
npm install 
# generate code + update the database
npm run codegen
```

After running `npm run codegen`, here's a list of generated files:

(The first time this is run, it'll take a while because it's downloading the base Docker image).

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
* `src/ent/user.ts` is the public facing API of the `User` object and what's consumed. It's also where [**custom code**](/docs/custom-queries/custom-accessors) can be added.
* `src/ent/generated/user_base.ts` is the base class for the `User` where more generated code will be added as the schema is changed over time.
* `src/schema/versions/*_add_users_tabl.py` is the generated database migration to add the `users` table
* `src/graphql` is where all the generated GraphQL files are with the GraphQL schema file being:

```graphql title="src/graphql/schema.gql"
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

After running
```shell
npm run compile && npm start
```

we have a **live** GraphQL server.

## Database changes
Note that the database was also updated by the command run above. Running `psql ent-starter` shows:
```db
ent-starter=# \d+ users
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
    "users_unique_email_address" UNIQUE CONSTRAINT, btree (email_address)

ent-starter=# 
```

## Adding writes
To support writes, update the schema as follows:

```ts title="src/schema/user.ts"
import { BaseEntSchema, Field, StringType, Action, ActionOperation } from "@lolopinto/ent/schema";
import { EmailType } from "@lolopinto/ent-email";
import { PasswordType } from "@lolopinto/ent-password";

export default class User extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    EmailType({ name: "EmailAddress", unique: true  }),
    PasswordType({ name: "Password" }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Create,
      fields: ["FirstName", "LastName", "EmailAddress", "Password"],
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
```graphql title="src/graphql/schema.gql"
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
  password: String!
}
```

Re-compile and restart the server:

```shell
npm run compile && npm start
```

Visit `http://localhost:4000/graphql` in your browser and then execute this query:

```graphql
mutation {
  userCreate(input:{firstName:"John", lastName:"Snow", emailAddress:"test@foo.com", password:"12345678"}) {
    user {
      id
      firstName
      emailAddress
      lastName
    }
  }
}
```

We get this error back: 

```json
{
  "errors": [
    {
      "message": "ent undefined is not visible for privacy reasons",
      "locations": [
        {
          "line": 2,
          "column": 3
        }
      ],
      "path": [
        "userCreate"
      ]
    }
  ],
  "data": null
}
```

Update `src/ent/user/actions/create_user_action.ts` as follows:

```ts title="src/ent/user/actions/create_user_action.ts"
import { Data, IDViewer, AlwaysAllowPrivacyPolicy } from "@lolopinto/ent";
import {
  CreateUserActionBase,
  UserCreateInput,
} from "src/ent/user/actions/generated/create_user_action_base";

export { UserCreateInput };

export default class CreateUserAction extends CreateUserActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  viewerForEntLoad(data: Data) {
    return new IDViewer(data.id);
  }
}
```

What changed above: 
* added `getPrivacyPolicy` method to change [permissions](/docs/actions/permissions) of who can perform the [action](/docs/actions/action).
* added `viewerForEntLoad` method to change who the [Viewer](/docs/core-concepts/viewer) is for the [Ent](/docs/core-concepts/ent) [load after](/docs/actions/viewer-ent-load).

Re-compile and restart the server:
```shell
npm run compile && npm start
```

Then rerun the GraphQL query again and you should get a response similar to:

```json
{
  "data": {
    "userCreate": {
      "user": {
        "id": "bm9kZTp1c2VyOjQ1Y2RkNmUyLWY2ZmItNDVlMC1iNWIwLWEwN2JlZWVmM2QxOQ==",
        "firstName": "John",
        "emailAddress": "test@foo.com",
        "lastName": "Snow"
      }
    }
  }
}
```

## Custom accessors
Update `src/ent/user.ts` as follows:
```ts title="src/ent/user.ts"
import { UserBase } from "src/ent/internal";
import { Interval } from "luxon";
import { GraphQLInt } from "graphql"
import { gqlField } from "@lolopinto/ent/graphql"

export class User extends UserBase {
  @gqlField({
    type: GraphQLInt
  })
  howLong() {
    return Interval.fromDateTimes(this.createdAt, new Date()).count('seconds');
  }
}
```

and then run the following command:
```shell
npm run codegen && npm run compile && npm start
```

and then run the following GraphQL query:
```graphql
mutation {
  userCreate(input:{firstName:"Sansa", lastName:"Stark", emailAddress:"sansa@stark.com", password:"12345678"}) {
    user {
      id
      firstName
      emailAddress
      lastName
      howLong
    }
  }
}
```

you should get a response similar to:

```json
{
  "data": {
    "userCreate": {
      "user": {
        "id": "bm9kZTp1c2VyOmQ3ZjMzODczLTgwOWUtNGZkMi04YjY4LWQxM2QwNGQwNjYwYw==",
        "firstName": "Sansa",
        "emailAddress": "sansa@stark.com",
        "lastName": "Stark",
        "howLong": 1
      }
    }
  }
}
```

What changed above:
* added a [custom accessor](/docs/custom-queries/custom-accessors) using [gqlField](/docs/custom-queries/gql-field)

## Query the Database
Run the following command:
`psql ent-starter`

And then run the following two commands:
```
ent-starter=# \x on 
Expanded display is on.
ent-starter=# select * from users;
-[ RECORD 1 ]-+-------------------------------------------------------------
id            | 45cdd6e2-f6fb-45e0-b5b0-a07beeef3d19
created_at    | 2021-05-25 22:37:18.662
updated_at    | 2021-05-25 22:37:18.7
first_name    | John
last_name     | Snow
email_address | test@foo.com
password      | $2a$10$vMDRfwWIacuBHnQsLSym2OwB77Xd.ERj5myqRQEEaAqyXZ5r3xmby
-[ RECORD 2 ]-+-------------------------------------------------------------
id            | d7f33873-809e-4fd2-8b68-d13d04d0660c
created_at    | 2021-05-25 22:43:39.078
updated_at    | 2021-05-25 22:43:39.113
first_name    | Sansa
last_name     | Stark
email_address | sansa@stark.com
password      | $2a$10$q1cwrLhDIiXOXQAjz7zN5u2KC2.QJ.WADfA2ozNuOTvjxrntJGNEC

ent-starter=# \q
```

## Unique Constraint
Running the following GraphQL query:
```graphql
mutation {
  userCreate(input:{firstName:"Arya", lastName:"Stark", emailAddress:"sansa@stark.com", password:"12345678"}) {
    user {
      id
      firstName
      emailAddress
      lastName
      howLong
    }
  }
}
```
should end with this error because we identified the `EmailAddress` as `unique` in the schema above: 

```json
{
  "errors": [
    {
      "message": "duplicate key value violates unique constraint \"users_unique_email_address\"",
      "locations": [
        {
          "line": 2,
          "column": 3
        }
      ],
      "path": [
        "userCreate"
      ]
    }
  ],
  "data": null
}
```

That's a quick introduction to what's supported here. We'll dive deeper into these concepts in the following sections.

