#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${root}"

# Run tests before cutting a release.
python -m pytest

# Bump the version in pyproject.toml before running this script.

# Build the sdist and wheel.
python3 -m build

# Upload to PyPI (or testpypi). Usage: ./release.sh [pypi|testpypi]
repo="${1:-pypi}"
python3 -m twine upload --repository "${repo}" dist/*

# Clean local build artifacts.
./clean.sh
