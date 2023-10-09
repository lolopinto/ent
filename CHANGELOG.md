# CHANGELOG

All notable changes to npm version @snowtop/ent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Changelog for the docker image are [here](/docker_CHANGELOG.md).

## [Unreleased]

## [0.1.20] - 2023-10-08

### Added

- support multiple joins and change the API to take a list instead of just one join (#1665).
- add BETA support for joins to CustomClauseQuery. API may change in the future (#1673).
- bump graphql peer dependency (#1674)
- instead of `RETURNING *` in actions, we indicate list of fields (#1677).

## [0.1.19] - 2023-10-08

### Fixed

- Fixed Custom Query soft delete (#1676)
