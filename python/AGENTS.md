# Python workspace notes

- Preferred Python for this repo is 3.14.x when updating the Pipenv lockfile.
- Use the helper script `python/scripts/refresh_pipenv_3_14.sh` to recreate the env, lock, install deps, and run tests.
- If `pipenv` picks the wrong interpreter, prefer the pipx-managed binary and set `PIPENV_PYTHON` to the full 3.14 path.
