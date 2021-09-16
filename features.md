# Ent framework

| Functionality                                                                                                    | Go                 | Typescript         | MVP                |
| ---------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------ | ------------------ |
| [Schema in code](#schema)                                                                                        | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| privacy                                                                                                          | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| [EntQuery](#entquery)                                                                                            |                    | :heavy_check_mark: | :heavy_check_mark: |
| [Mutations/actions](#actions)                                                                                    | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| per field privacy                                                                                                |                    |                    | :heavy_check_mark: |
| data loaders (n+1 issue)                                                                                         |                    | :heavy_check_mark: | :heavy_check_mark: |
| [support different caches](#cache-support)                                                                       |                    | :heavy_check_mark: |                    |
| per request in memory cache (raw data)                                                                           |                    | :heavy_check_mark: | :heavy_check_mark: |
| per request in memory cache (viewer\|ents)                                                                       |                    |                    | :heavy_check_mark: |
| [auth](#auth)                                                                                                    |                    | :heavy_check_mark: | :heavy_check_mark: |
| patterns \| mixins                                                                                               |                    | :heavy_check_mark: | :heavy_check_mark: |
| Correct imports in generated file                                                                                | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| custom functions/accessors in ents                                                                               | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| custom top level functions                                                                                       | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| sharding                                                                                                         |                    |                    |                    |
| file uploads                                                                                                     |                    | :heavy_check_mark: | :heavy_check_mark: |
| encryption at rest                                                                                               |                    |                    |                    |
| Fb style fbobject and everything that comes with that <br /> e.g. FriendFeed style indices etc and go from there |                    |                    |                    |
| can viewer do                                                                                                    |                    |                    |                    |
| load multiple ids easily                                                                                         | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| concurrency                                                                                                      | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| load ents/ids from unique/indices                                                                                | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| Init/setup                                                                                                       | :heavy_check_mark: |                    | :heavy_check_mark: |
| CLI                                                                                                              | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| [database migrations](#database-migrations)                                                                      | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| ent configuration (code ideal/yaml second)                                                                       |                    | :heavy_check_mark: | :heavy_check_mark: |
| load assoc config in memory once                                                                                 |                    | :heavy_check_mark: |                    |
| deleted_at and similar ways to change behavior                                                                   |                    |                    | :heavy_check_mark: |
| dockerize everything to run in production/download easily                                                        |                    | :heavy_check_mark: | :heavy_check_mark: |
| [Different primary id types](#ids)                                                                               |                    |                    | :heavy_check_mark: |
| privacy at creation/edit/etc                                                                                     |                    | :heavy_check_mark: | :heavy_check_mark: |
| sql builder/custom sql queries                                                                                   | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| Colocation (part of sharding)                                                                                    |                    |                    |                    |
| Payments                                                                                                         |                    |                    |                    |
| integration with microservices/different data sources                                                            |                    |                    |                    |
| different databases (other than postgres)                                                                        |                    |                    |                    |
| [GraphQL](#graphql)                                                                                              | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| easy testing                                                                                                     |                    |                    | :heavy_check_mark: |
| import from db                                                                                                   |                    |                    | strong follow-on   |
| import from other schemas?                                                                                       |                    |                    | strong follow-on   |
| feature flags (+ built into permissions)                                                                         |                    |                    |                    |

## Schema

| Functionality            | Go                 | Typescript         | MVP                |
| ------------------------ | ------------------ | ------------------ | ------------------ |
| [Fields](#fields-schema) | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| Custom Table name        | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| Default Table name       |                    | :heavy_check_mark: | :heavy_check_mark: |
| [Edges](#edges)          | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| actions                  | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| composite indices        |                    | :heavy_check_mark: | :heavy_check_mark: |
| composite unique fields  |                    | :heavy_check_mark: | :heavy_check_mark: |
| composite primary keys   |                    | :heavy_check_mark: | :heavy_check_mark: |
| patterns                 |                    | :heavy_check_mark: | :heavy_check_mark: |
| hide from graphql        |                    | :heavy_check_mark: | :heavy_check_mark: |

## Fields (schema)

| Functionality                 | Go                 | Typescript         | MVP                |
| ----------------------------- | ------------------ | ------------------ | ------------------ |
| Server default (stored in db) | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| override db name              | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| override graphql name         | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| unique field                  | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| hide from graphql             | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| private                       | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| index                         | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| foreign key                   | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| field edge                    | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| primary key                   |                    | :heavy_check_mark: | :heavy_check_mark: |
| disableUserEditable           |                    | :heavy_check_mark: | :heavy_check_mark: |
| default value on create       |                    | :heavy_check_mark: | :heavy_check_mark: |
| default value on edit         |                    | :heavy_check_mark: | :heavy_check_mark: |

## Fields (functionality)

| Functionality | Go                 | Typescript         | MVP                |
| ------------- | ------------------ | ------------------ | ------------------ |
| validate      | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| format        | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| allow blank?  |                    |                    |                    |
| allow nil?    |                    |                    |                    |

## DataTypes

| Functionality                | Go                 | Typescript         | MVP                |
| ---------------------------- | ------------------ | ------------------ | ------------------ |
| Uuid                         | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| String                       | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| int                          | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| float                        | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| bool                         | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| time                         | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| ints                         | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| strings                      | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| floats                       | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| json (but not postgres type) | :heavy_check_mark: |                    | :heavy_check_mark: |
| postgres json                |                    |                    |                    |
| string enums                 |                    | :heavy_check_mark: | :heavy_check_mark: |
| int enums                    |                    |                    |                    |
| custom type (part of json)   | :heavy_check_mark: |                    | :heavy_check_mark: |
| email                        | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| password                     | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| phone number                 | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| Url                          | :heavy_check_mark: |                    | :heavy_check_mark: |

## Edges

| Functionality                                                                                                                     | Go                 | Typescript         | MVP                |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------ | ------------------ |
| foreign keys                                                                                                                      | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| [assoc edges](#assoc-edges)                                                                                                       | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| [assoc group](#assoc-group)                                                                                                       | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| three way edge with id in data field                                                                                              |                    |                    | :heavy_check_mark: |
| Easy customizations for the popular edges in different frameworks etc: <br />e.g. one-way, many-to-many that does the right thing |                    |                    | :heavy_check_mark: |
| polymorphic edges                                                                                                                 |                    | :heavy_check_mark: | :heavy_check_mark: |
| "join tables"                                                                                                                     |                    |                    | :heavy_check_mark: |

### assoc edges

| Functionality     | Go                 | Typescript         | MVP                |
| ----------------- | ------------------ | ------------------ | ------------------ |
| unique            | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| symmetric         | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| Inverse           | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| Counts            |                    | :heavy_check_mark: | :heavy_check_mark: |
| polymorphic edges |                    |                    | :heavy_check_mark: |

### assoc group

| Functionality | Go                 | Typescript | MVP |
| ------------- | ------------------ | ---------- | --- |
| status        | :heavy_check_mark: |            |     |

## GraphQL

| Functionality                        | Go                 | Typescript         | MVP                |
| ------------------------------------ | ------------------ | ------------------ | ------------------ |
| base case (everything)               | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| persisted queries                    |                    |                    | :heavy_check_mark: |
| only gql errors returned to the user |                    |                    | :heavy_check_mark: |
| Subscriptions                        |                    |                    |                    |
| easy testing                         |                    | :heavy_check_mark: | :heavy_check_mark: |
| entquery                             |                    | :heavy_check_mark: | :heavy_check_mark: |

## EntQuery

| Functionality                                         | Go  | Typescript         | MVP                |
| ----------------------------------------------------- | --- | ------------------ | ------------------ |
| ids                                                   |     | :heavy_check_mark: | :heavy_check_mark: |
| Edges                                                 |     | :heavy_check_mark: | :heavy_check_mark: |
| fetch one id                                          |     |                    | :heavy_check_mark: |
| Intersection                                          |     |                    |                    |
| per edge privacy                                      |     |                    | :heavy_check_mark: |
| union                                                 |     |                    |                    |
| custom logic                                          |     |                    |                    |
| counts (raw \| privacy backed)                        |     | :heavy_check_mark: | :heavy_check_mark: |
| ordering (sort by time/ name etc easily)              |     |                    | :heavy_check_mark: |
| filters e.g. pagination                               |     | :heavy_check_mark: | :heavy_check_mark: |
| named custom queries                                  |     | :heavy_check_mark: | :heavy_check_mark: |
| toggle btw crazy joins and loading objects one by one |     |                    |

## database migrations

| Functionality | Go  | Typescript | MVP                |
| ------------- | --- | ---------- | ------------------ |
| default       |     |            | :heavy_check_mark: |
| Up            |     |            | :heavy_check_mark: |
| down          |     |            | :heavy_check_mark: |
| custom fields |     |            | :heavy_check_mark: |

## Actions

| Functionality                                   | Go                 | Typescript         | MVP                 |
| ----------------------------------------------- | ------------------ | ------------------ | ------------------- |
| custom actions (schema)                         | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark:  |
| Easy create/edit/delete generated/editable      | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark:  |
| observers                                       | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark:  |
| validators                                      | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark:  |
| triggers                                        | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark:  |
| permissions                                     | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark:  |
| inverse edge (write field edge)                 | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark:  |
| nullable fields                                 | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark:  |
| custom mutation fields                          |                    | :heavy_check_mark: | :heavy_check_mark:  |
| custom data/time for edges                      | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark:  |
| placeholders and resolvers                      | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark:  |
| integrate fields                                | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark:  |
| built in transactions                           | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark:  |
| default observers (send text \| email \| slack) |                    |                    | strong nice to have |
| custom actions called from custom functions     |                    |                    | :heavy_check_mark:  |

## cache support

| Functionality | Go  | Typescript | MVP                |
| ------------- | --- | ---------- | ------------------ |
| Redis         |     |            | :heavy_check_mark: |
| Memory        |     |            | :heavy_check_mark: |
| memcache      |     |            |                    |

## Auth

| Functionality    | Go                 | Typescript         | MVP                |
| ---------------- | ------------------ | ------------------ | ------------------ |
| passwordless     |                    |                    |                    |
| email/password   | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| phone number/pin | :heavy_check_mark: |                    | :heavy_check_mark: |
| auth0            | :heavy_check_mark: |                    | :heavy_check_mark: |
| passport         |                    | :heavy_check_mark: | :heavy_check_mark: |
| facebook         |                    |                    |                    |
| google           |                    |                    |                    |
| github           |                    |                    |                    |
| twitter          |                    |                    |                    |
| sessions         |                    |                    |                    |
| stateless        |                    |                    |                    |
| mfa              |                    |                    |                    |
| 2fa              |                    |                    |                    |
| apple            |                    |                    |                    |
| Face ID          |                    |                    |                    |

## ids

| Functionality                  | Go                 | Typescript         | MVP                |
| ------------------------------ | ------------------ | ------------------ | ------------------ |
| Uuid                           | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| int64 (auto increment)         |                    |                    | :heavy_check_mark: |
| Int32 (auto increment)         |                    |                    |                    |
| custom id (not auto increment) |                    |                    |                    |
