# RELEASING

This follows the high level steps at https://packaging.python.org/tutorials/packaging-projects/.

## Dependencies

* `setuptools`
* `wheel`
* `twine`

Can get the latest of each via the following command: `python3 -m pip install --user --upgrade setuptools wheel twine` or `python3 -m pip install --upgrade setuptools wheel twine` in a venv.

## Releasing

Steps to release new version:

* Run `python -m pytest -sv` (in pipenv shell maybe) to ensure all tests are passing
* Bump version in `setup.py`
* Run the following command from `python/auto_schema` (where `setup.py` is located): `python3 setup.py sdist bdist_wheel`.
* Run `python3 -m twine upload --repository pypi dist/*` to upload to pypi OR `python3 -m twine upload --repository testpypi dist/*`. You need to be added to the project and have a [token](https://pypi.org/help/#apitoken) (or [test token](https://test.pypi.org/help/#apitoken))  in `~/.pypirc` or equivalent location.
* Recommend cleaning up after by running `rm -rf dist/`

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