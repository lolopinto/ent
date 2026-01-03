# CHANGELOG

All notable changes to the docker image will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Changelog for the npm version are [here](/CHANGELOG.md).

## [Unreleased]

### Fixed

- fix types for struct list for on demand types (#1911)
- exclude action-only fields when embedding action inputs (#1914)
- fix builder codegen for list inverse edges (#1915)
- fix action custom inputs to use public field names when field privacy is enabled (#1874)
- fix generation of union types to be deterministic (#1919)
- fix bug which lead to union types to be missing sometimes (#1920)

## [0.3.0]

### Added

- DateType as string (#1887)
- add global edge composite indices for extra edge fields (#1897)
- support concurrent index creation in auto_schema migrations (#1901)
- support partial indexes with WHERE clauses in schema indices (#1903)

### Fixed

- Fix optionality for default-provided action fields #1890
- fix struct fields that are fetchOnDemand and have a privacy policy (#1893)
- treat global schema changes as full codegen changes (#1898)

## [0.2.0-alpha.13]

### Added

- ability to customize default ordering for an indexed edge #1878
- add ondelete option to fkey so it's customizable #1879

## [0.2.0-alpha.12] 

### Added

- port .swcrc logic into central location and reuse #1862

### Fixes

- don't hardcode return type of custom mutations #1872
- ensure that custom imports are indicated as used so that we keep the import



## [0.2.0-alpha.10]

### Added

- Updated error when there's duplicate names in generated GraphQL Schema (#1857)

## [0.2.0-alpha.9] - 2024-11-11

### Fixed

- Fix UUID fields in struct fields (#1843)

## [0.2.0-alpha.8] - 2024-09-05

### Fixed

- Fix invalid generated TS "float" type (#1828)

## [0.2.0-alpha.6] - 2024-06-06

### Added

- add viewer to generated pattern types (#1800)
- add query methods to patterns for fieldEdge and foreignKeys defined in pattern (#1801)
- union type for patterns (#1810)


### Fixed

- stop ignoring actionOnlyFields in edge actions (#1811)


## [0.2.0-alpha.5] - 2024-03-09

### Fixed

- Allow input objects to have nested input objects (#1795)

## [0.2.0-alpha.4] - 2024-03-01

### Fixed

- fix generated date types (#1787)

## [0.2.0-alpha.3] - 2024-03-01

### Fixed

- make it so that fooId UUID fieldEdge works (#1779)
- fix @gqlField with gqlConnection and args with custom types (#1780)

## [0.2.0-alpha.2] - 2024-02-29

### Added

- Add hideFromGraphQL to InverseAssocEdge (#1766)
- Add support for @gqlField with gqlConnection and args (#1768)

### Fixed

- Fix graphql imports for custom files (#1775)
- Fix imports for custom objects in files (#1776)

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
- changes enum names with numbers fro FOO_1 to FOO1

## [0.1.17] - 2024-01-21

### Added

- Typescript user-defined type guard functions for patterns (#1735)

## [0.1.16] - 2023-12-09

### Fixed

- changed error message when changing database type to be more descriptive (#1726)
- fix disableBuilderType in UUIDType not respected when defaultValueOnCreate is true and disableUserGraphQLEditable is true (#1727)

## [0.1.15] - 2023-12-08

### Fixed

- Updated swc and ts-node to latest versions. Adds module to generated .swcrc used for graphql codegen (#1717)
- fix EdgeGroup actions sets incorrect ent type in DB (#1719)
- Fix id fields with disable user graphql editable (#1723)

## [0.1.14] - 2023-11-06

### Fixed

- fix #1706. take 2 but with edit actions (#1711)

## [0.1.13] - 2023-11-05

### Fixed

- Fix optional non-nullable field in action not being optional in certain actions (#1708)

## [0.1.12] - 2023-10-30

### Fixed

- Export interfaces and other types generated in mixin builders (#1704)

## [0.1.11] - 2023-10-14

### Added

- ability to configure exports for actions not to be default export (#1689)

## [0.1.10] - 2023-10-08

### Fixed

- Fix types.ts referencing itself in imports (#1678)
