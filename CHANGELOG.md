# CHANGELOG

All notable changes to npm version @snowtop/ent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Changelog for the docker image are [here](/docker_CHANGELOG.md).

## [Unreleased]

## [0.2.2] - 2025-02-22
- ability to customize default ordering for an indexed edge (#1878)
- add ondelete option to fkey so it's customizable #1879

## [0.2.1] - 2025-01-01

### Added

- New privacy rules (#1869)

## [0.2.0] - 2024-11-17

### Breaking

- make generation of names (database columns, graphql names etc) more consistent (#1757). changes names for the following field types in schemas: 
  * `userID` field -> `userId` GraphQL field and `userId` TypeScript variable instead of `userID`
  * `foo2` field -> `foo2` database column instead of `foo_2` database column
  * `userIDs` field -> `userIds` GraphQL field and `userIds` TypeScript variable instead of `userIDs`
  * and a few other related changes
  * the existing names can be kept by using `storageKey` and `graphqlName` in the schema files so that there doesn't have to be any production impact.
  * standardizes on `Id` instead of `ID` so functions like `User.loadIDFromEmailAddress` become `User.loadIdFromEmailAddress`
- changes generated files for patterns to make them more customizable (#1760)

### Added

- join types (#1840)
- disableBase64Encode for uuid types (#1843)
- Adjust edge queries to support multiple sort columns (#1834)
- Allow async edge connections (#1829)
- Add hideFromGraphQL to InverseAssocEdge (#1766)
- change id in default pattern from `ID` to `id` (#1763)
  * references to `ID` in say foreign key definitions will have to be updated

### Fixed

- Save polymorphic types in structs (#1852)
- fix CustomClauseQuery in GraphQL ent fields (#1837)
- Allow input objects to have nested input objects (#1795)
- fix transformWrite formatting data incorrectly (#1783)


## [0.2.0-alpha.10] - 2024-11-13

### Fixed

- Save polymorphic types in structs (#1852)

## [0.2.0-alpha.9] - 2024-11-11

### Added

- join types (#1840)
- disableBase64Encode for uuid types (#1843)

## [0.2.0-alpha.8] - 2024-10-07

### Fixed

- fix CustomClauseQuery in GraphQL ent fields (#1837)

## [0.2.0-alpha.7] - 2024-10-01

### Added

- Adjust edge queries to support multiple sort columns (#1834)

## [0.2.0-alpha.6] - 2024-09-05

### Added

- Allow async edge connections (#1829)

## [0.2.0-alpha.5] - 2024-03-09

### Fixed

- Allow input objects to have nested input objects (#1795)

## [0.2.0-alpha.4] - 2024-03-01

### Fixed

- fix transformWrite formatting data incorrectly (#1783)

## [0.2.0-alpha.3] - 2024-02-29

### Added

- Add hideFromGraphQL to InverseAssocEdge (#1766)


## [0.2.0-alpha.2] - 2024-02-23

- change id in default pattern from `ID` to `id` (#1763)
  * references to `ID` in say foreign key definitions will have to be updated

## [0.2.0-alpha.1] - 2024-02-22

### Breaking

- make generation of names (database columns, graphql names etc) more consistent (#1757). changes names for the following field types in schemas: 
  * `userID` field -> `userId` GraphQL field and `userId` TypeScript variable instead of `userID`
  * `foo2` field -> `foo2` database column instead of `foo_2` database column
  * `userIDs` field -> `userIds` GraphQL field and `userIds` TypeScript variable instead of `userIDs`
  * and a few other related changes
  * the existing names can be kept by using `storageKey` and `graphqlName` in the schema files so that there doesn't have to be any production impact.
  * standardizes on `Id` instead of `ID` so functions like `User.loadIDFromEmailAddress` become `User.loadIdFromEmailAddress`
- changes generated files for patterns to make them more customizable (#1760)


## [0.1.26] - 2024-02-18

### Added

- Add an ability to specify field aliases on a per-field basis (#1753)

## [0.1.25] - 2024-02-11

### Added

- Forward overrideAlias to isNullClause (#1747)

## [0.1.24] - 2024-02-08

### Added

- Add ability to remove alias from order by clause or to specify alias for order by (#1745)

## [0.1.23] - 2024-01-21

### Added

- Validate that we can't have multiple patterns with the same name (#1733)

### Fixed

- fix issue with StructTypeAsList globalType fields during create (#1734)

## [0.1.22] - 2023-12-08

### Added

- add alias to QueryDataOptions (#1714)
- update a bunch of dependencies (#1728)

## [0.1.21] - 2023-10-14

### Added

- ability to configure exports for actions not to be default export (#1689)

## [0.1.20] - 2023-10-08

### Added

- support multiple joins and change the API to take a list instead of just one join (#1665).
- add BETA support for joins to CustomClauseQuery. API may change in the future (#1673).
- bump graphql peer dependency (#1674)
- instead of `RETURNING *` in actions, we indicate list of fields (#1677).

## [0.1.19] - 2023-10-08

### Fixed

- Fixed Custom Query soft delete (#1676)
