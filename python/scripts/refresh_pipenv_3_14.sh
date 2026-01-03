#!/usr/bin/env bash
set -euo pipefail

PYTHON_314=/Library/Frameworks/Python.framework/Versions/3.14/bin/python3.14
PIPENV_PYTHON=$PYTHON_314 pipenv --rm
PIPENV_PYTHON=$PYTHON_314 pipenv --python "$PYTHON_314" lock
PIPENV_PYTHON=$PYTHON_314 pipenv --python "$PYTHON_314" install --dev
pipenv run pytest -svv
