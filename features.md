# Ent framework

| Functionality                                                                                                    |         Go         |     Typescript     |
| ---------------------------------------------------------------------------------------------------------------- | :----------------: | :----------------: |
| [Schema](#schema)                                                                                                | :heavy_check_mark: | :heavy_check_mark: |
| privacy                                                                                                          | :heavy_check_mark: | :heavy_check_mark: |
| [EntQuery](#entquery)                                                                                            |                    |                    |
| [Mutations/actions](#actions)                                                                                    | :heavy_check_mark: |                    |
| per field privacy                                                                                                |                    |                    |
| data loaders (n+1 issue)                                                                                         |                    |                    |
| [support different caches](#cache-support)                                                                       |                    |                    |
| per request in memory cache (raw data)                                                                           |                    |                    |
| per request in memory cache (viewer\|ents)                                                                       |                    |                    |
| [auth](#auth)                                                                                                    |                    |                    |
| patterns                                                                                                         |                    | :heavy_check_mark: |
| Correct imports in generated file                                                                                | :heavy_check_mark: |                    |
| custom functions/accessors in ents                                                                               | :heavy_check_mark: |                    |
| custom top level functions                                                                                       | :heavy_check_mark: |                    |
| sharding                                                                                                         |                    |                    |
| file uploads                                                                                                     |                    |                    |
| encryption at rest                                                                                               |                    |                    |
| Fb style fbobject and everything that comes with that <br /> e.g. FriendFeed style indices etc and go from there |                    |                    |
| can viewer do                                                                                                    |                    |                    |
| load multiple ids easily                                                                                         | :heavy_check_mark: | :heavy_check_mark: |
| concurrency                                                                                                      | :heavy_check_mark: | :heavy_check_mark: |
| load ents/ids from unique/indices                                                                                | :heavy_check_mark: | :heavy_check_mark: |
| Init/setup                                                                                                       | :heavy_check_mark: |                    |
| CLI                                                                                                              | :heavy_check_mark: | :heavy_check_mark: |
| [database migrations](#database-migrations)                                                                      | :heavy_check_mark: | :heavy_check_mark: |
| ent configuration (yml?)                                                                                         |                    |                    |
| load assoc config in memory once                                                                                 |                    |                    |
| deleted_at and similar ways to change behavior                                                                   |                    |                    |
| dockerize everything to run in production/download easily                                                        |                    |                    |
| [Different primary id types](#ids)                                                                               |                    |                    |
| privacy at creation/edit/etc                                                                                     |                    |                    |
| sql builder/custom sql queries                                                                                   | :heavy_check_mark: |                    |
| Colocation (part of sharding)                                                                                    |                    |                    |
| Payments                                                                                                         |                    |                    |
| integration with microservices/different data sources                                                            |                    |                    |
| different databases (other than postgres)                                                                        |                    |                    |

# Schema

| Functionality            |         Go         |     Typescript     |
| ------------------------ | :----------------: | :----------------: |
| [Fields](#fields-schema) | :heavy_check_mark: | :heavy_check_mark: |
| Custom Table name        | :heavy_check_mark: | :heavy_check_mark: |
| Default Table name       |                    | :heavy_check_mark: |
| [Edges](#edges)          | :heavy_check_mark: | :heavy_check_mark: |
| actions                  | :heavy_check_mark: |                    |
| composite indices        |                    |                    |
| composite unique fields  |                    |                    |
| composite primary keys   |                    |                    |
| patterns                 |                    |                    |
| hide from graphql        |                    |                    |

# Fields (schema)

| Functionality                 |         Go         |     Typescript     |
| ----------------------------- | :----------------: | :----------------: |
| Server default (stored in db) | :heavy_check_mark: | :heavy_check_mark: |
| override db name              | :heavy_check_mark: | :heavy_check_mark: |
| override graphql name         | :heavy_check_mark: | :heavy_check_mark: |
| unique field                  | :heavy_check_mark: | :heavy_check_mark: |
| hide from graphql             | :heavy_check_mark: | :heavy_check_mark: |
| private                       | :heavy_check_mark: | :heavy_check_mark: |
| index                         | :heavy_check_mark: | :heavy_check_mark: |
| foreign key                   | :heavy_check_mark: | :heavy_check_mark: |
| field edge                    | :heavy_check_mark: | :heavy_check_mark: |
| primary key                   |                    | :heavy_check_mark: |
| disableUserEditable           |                    | :heavy_check_mark: |
| default value on create       |                    | :heavy_check_mark: |
| default value on edit         |                    | :heavy_check_mark: |

# Fields (functionality)

| Functionality |         Go         | Typescript |
| ------------- | :----------------: | :--------: |
| validate      | :heavy_check_mark: |            |
| format        | :heavy_check_mark: |            |
| allow blank?  |                    |            |
| allow nil?    |                    |            |

# DataTypes

| Functionality                |         Go         |     Typescript     |
| ---------------------------- | :----------------: | :----------------: |
| Uuid                         | :heavy_check_mark: | :heavy_check_mark: |
| String                       | :heavy_check_mark: | :heavy_check_mark: |
| int                          | :heavy_check_mark: | :heavy_check_mark: |
| float                        | :heavy_check_mark: | :heavy_check_mark: |
| bool                         | :heavy_check_mark: | :heavy_check_mark: |
| time                         | :heavy_check_mark: | :heavy_check_mark: |
| ints                         | :heavy_check_mark: |                    |
| strings                      | :heavy_check_mark: |                    |
| floats                       | :heavy_check_mark: |                    |
| json (but not postgres type) | :heavy_check_mark: |                    |
| postgres json                |                    |                    |
| string enums                 |                    |                    |
| int enums                    |                    |                    |
| custom type (part of json)   | :heavy_check_mark: |                    |
| email                        | :heavy_check_mark: |                    |
| password                     | :heavy_check_mark: |                    |
| phone number                 | :heavy_check_mark: |                    |
| Url                          | :heavy_check_mark: |                    |

# Edges

| Functionality                                                                                                                     |         Go         |     Typescript     |
| --------------------------------------------------------------------------------------------------------------------------------- | :----------------: | :----------------: |
| foreign keys                                                                                                                      | :heavy_check_mark: | :heavy_check_mark: |
| [assoc edges](#assoc-edges)                                                                                                       | :heavy_check_mark: | :heavy_check_mark: |
| [assoc group](#assoc-group)                                                                                                       | :heavy_check_mark: |                    |
| three way edge with id in data field                                                                                              |                    |                    |
| Easy customizations for the popular edges in different frameworks etc: <br />e.g. one-way, many-to-many that does the right thing |                    |                    |
| polymorphic edges                                                                                                                 |                    |                    |
| "join tables"                                                                                                                     |                    |                    |

## assoc edges

| Functionality     |         Go         |     Typescript     |
| ----------------- | :----------------: | :----------------: |
| unique            | :heavy_check_mark: | :heavy_check_mark: |
| symmetric         | :heavy_check_mark: | :heavy_check_mark: |
| Inverse           | :heavy_check_mark: | :heavy_check_mark: |
| Counts            |                    | :heavy_check_mark: |
| polymorphic edges |                    |                    |

## assoc group

| Functionality |         Go         | Typescript |
| ------------- | :----------------: | :--------: |
| status        | :heavy_check_mark: |            |

# GraphQL

| Functionality                        |         Go         | Typescript |
| ------------------------------------ | :----------------: | :--------: |
| base case (everything)               | :heavy_check_mark: |            |
| persisted queries                    |                    |            |
| only gql errors returned to the user |                    |            |
| Subscriptions                        |                    |            |
| easy testing                         |                    |            |
| entquery                             |                    |            |

# EntQuery

| Functionality                  | Go  | Typescript |
| ------------------------------ | :-: | :--------: |
| ids                            |     |            |
| Edges                          |     |            |
| fetch one id                   |     |            |
| Intersection                   |     |            |
| per edge privacy               |     |            |
| union                          |     |            |
| custom logic                   |     |            |
| counts (raw \| privacy backed) |     |            |
| ordering                       |     |            |
| filters                        |     |            |
| named custom queries           |     |            |

# database migrations

| Functionality | Go  | Typescript |
| ------------- | :-: | :--------: |
| default       |     |            |
| Up            |     |            |
| down          |     |            |
| custom fields |     |            |

# Actions

| Functionality                                     |         Go         | Typescript |
| ------------------------------------------------- | :----------------: | :--------: |
| custom actions (schema)                           | :heavy_check_mark: |            |
| Easy create/edit/delete generated/editable        | :heavy_check_mark: |            |
| observers                                         | :heavy_check_mark: |            |
| validators                                        | :heavy_check_mark: |            |
| triggers                                          | :heavy_check_mark: |            |
| permissions                                       | :heavy_check_mark: |            |
| inverse edge (write field edge)                   | :heavy_check_mark: |            |
| nullable fields                                   | :heavy_check_mark: |            |
| custom mutation fields                            |                    |            |
| custom data/time for edges                        | :heavy_check_mark: |            |
| placeholders and resolvers                        | :heavy_check_mark: |            |
| integrate fields                                  | :heavy_check_mark: |            |
| built in transactions                             | :heavy_check_mark: |            |
| default triggers (phone number \| email \| slack) |                    |            |
| custom actions called from custom functions       |                    |            |

# cache support

| Functionality | Go  | Typescript |
| ------------- | :-: | :--------: |
| Redis         |     |            |
| Memory        |     |            |
| memcache      |     |            |

# Auth

| Functionality    |         Go         | Typescript |
| ---------------- | :----------------: | :--------: |
| passwordless     |                    |            |
| email/password   | :heavy_check_mark: |            |
| phone number/pin | :heavy_check_mark: |            |
| auth0            | :heavy_check_mark: |            |
| passport         |                    |            |
| facebook         |                    |            |
| google           |                    |            |
| github           |                    |            |
| twitter          |                    |            |
| sessions         |                    |            |
| stateless        |                    |            |
| mfa              |                    |            |
| 2fa              |                    |            |
| apple            |                    |            |
| Face ID          |                    |            |

# ids

| Functionality                  |         Go         |     Typescript     |
| ------------------------------ | :----------------: | :----------------: |
| Uuid                           | :heavy_check_mark: | :heavy_check_mark: |
| int64 (auto increment)         |                    |                    |
| Int32 (auto increment)         |                    |                    |
| custom id (not auto increment) |                    |                    |
