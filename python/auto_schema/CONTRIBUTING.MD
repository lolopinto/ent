# CONTRIBUTING

Put core regression tests in this package's `tests/` directory, extending the
suite for the affected implementation (for example, `runner_test.py`,
`renderers_test.py`, or `ops_sql_test.py`). Migration comparison and replay
tests may use real databases and shared fixtures; they must run through pytest
without depending on the codegen matrix. Matrix fixtures add representative
schema-to-DB integration checks, not the core migration test suite. See
[the repository test ownership rules](../../AGENTS.md#test-ownership-and-placement).

make changes to code and then run as following:

* `pipenv shell` to get into virtual environment.
* run a test: `python -m pytest -k test_enum_type`
* run all tests: `python -m pytest`
* install the incremental type checker once: `python -m pip install ty==0.0.28`
* run the incremental type check: `ty check --python "$(pipenv --py)"`

* `pip3 install pipenv` to install `pipenv`
* `pipenv install --dev` to install dependencies from `Pipfile`
* `pipenv lock` to fix `Pipfile.lock` if you add and remove something

or it uses the one provided via environment variable `DB_CONNECTION_STRING`

To run `auto_schema` locally, from the `python/auto_schema` directory, run:

```shell
LOCAL_AUTO_SCHEMA=true python3 auto_schema/cli/__init__.py -e postgresql://ola:@localhost/tsent_test -s /Users/ola/code/ent/examples/simple/src/schema  --history
```

`LOCAL_AUTO_SCHEMA` is to ensure that your changes are seen over any installed `auto_schema` .
