# CHANGELOG

All notable changes to the docker image will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Changelog for the npm version are [here](/CHANGELOG.md).

## [Unreleased]

### Fixed

- fix EdgeGroup actions sets incorrect ent type in DB (#1719)

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
