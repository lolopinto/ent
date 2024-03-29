# CONTRIBUTING

make changes to code and then run as following:

* `pipenv shell` to get into virtual environment.
* run a test: `python -m pytest -k test_enum_type`
* run all tests: `python -m pytest`

* `pip3 install pipenv` to install `pipenv`
* `pipenv install --dev` to install dependencies from `Pipfile`
* `pipenv lock` to fix `Pipfile.lock` if you add and remove something

or it uses the one provided via environment variable `DB_CONNECTION_STRING`

To run `auto_schema` locally, from the `python/auto_schema` directory, run:

```shell
LOCAL_AUTO_SCHEMA=true python3 auto_schema/cli/__init__.py -e postgresql://ola:@localhost/tsent_test -s /Users/ola/code/ent/examples/simple/src/schema  --history
```

`LOCAL_AUTO_SCHEMA` is to ensure that your changes are seen over any installed `auto_schema` .
