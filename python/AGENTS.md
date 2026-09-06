# Python workspace notes

- Follow [the repository test ownership rules](../AGENTS.md#test-ownership-and-placement).
  Core Python regressions belong in the owning package's tests. For
  `auto_schema`, put comparison, normalization, rendering, operation ordering,
  and upgrade/downgrade/replay coverage in `auto_schema/tests/`, using real DB
  tests where needed. Codegen DB fixtures provide additional integration
  coverage and must not be the only tests of migration behavior.
- Preferred Python for this repo is 3.14.x when updating the Pipenv lockfile.
- Use the helper script `python/scripts/refresh_pipenv_3_14.sh` to recreate the env, lock, install deps, and run tests.
- If `pipenv` picks the wrong interpreter, prefer the pipx-managed binary and set `PIPENV_PYTHON` to the full 3.14 path.
