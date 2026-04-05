# RELEASING

This follows the high level steps at https://packaging.python.org/en/latest/tutorials/packaging-projects/.

## Dependencies

* `build`
* `setuptools`
* `wheel`
* `twine`

Can get the latest of each via the following command: `python3 -m pip install --upgrade build setuptools wheel twine` in a venv.

## Releasing

Steps to release new version:

* Bump version in `pyproject.toml`
* Run `./release.sh` from `python/auto_schema` to run tests, build, upload, and clean.
* For testpypi, run `./release.sh testpypi` instead.

## Testing

To test, install as follows:

```shell
python3 -m pip install auto_schema=={version}
```

and test version:

```shell
python3 -m pip install --index-url https://test.pypi.org/simple/ auto-schema-test
```

If done in a `venv`, prerequisites are as follows:

* `python3 -m venv .`
* `source ./bin/activate`

For more about virtual environments, checkout https://packaging.python.org/tutorials/installing-packages/#creating-and-using-virtual-environments.

Run command as follows:

`auto_schema -s='/Users/ola/code/ent/ts/examples/simple/src/schema' -e='postgres://ola:@localhost:5432/tsent_test'`

(replace path and postgres connection string as needed)
