make changes to code and then run as following:

* `pipenv shell` to get into virtual environment.
* run a test: `python -m pytest -k test_enum_type `
* run all tests: `python -m pytest`

assumes a local postgres db named `autoschema_test` exists

credentials: `postgresql://localhost/autoschema_test`