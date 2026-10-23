# Docker image releases

From this directory, `go run .` renders the supported images and prints the
build commands without building or publishing. `go run . --push` builds and
publishes them using the release versions in the adjacent `.txt` files.

Node is installed from the selected major's repository. The image build rejects
an installed version below the minimum in `ts/check-node-version.sh` or from a different major.
Newer patches and minor releases within that major are accepted.

For the standalone `ts/Dockerfile`, `--build-arg NODE_VERSION=22` also selects
the Node 22 minimum by default. An explicit `--build-arg NODE_MIN_VERSION=...`
overrides that default. Unsupported majors fail the build.

Normal builds can reuse a previously validated Node installation from Docker's
cache. To fetch runtime packages again, add `--refresh-runtimes`:

```sh
# Preview the commands; no images are published.
go run . --refresh-runtimes

# Build and publish after approving a release.
go run . --push --refresh-runtimes
```

The refresh flag bypasses caching for `final-image`, which installs Node and
other final-image packages. Go compilation and the Python migration-tool stage
remain cacheable. Explicit version pins for other runtimes are unchanged.
Raising the Node minimum changes the installation layer and invalidates its
cache even without this flag. Consumers adopt the published image separately.

## Tests

`go test ./release_image` checks generation, CLI arguments, and (where `dpkg`
is available) the shared Node check script directly. Script cases use a stub
Node executable and the real Debian version comparator; no Dockerfile parsing
or image builds are required.

The standalone build-argument regression is an explicit integration test:

```sh
ENT_DOCKER_TESTS=1 go test ./release_image -run '^TestStandaloneDockerNodeOverride$' -count=1
```

Run that command from the repository root. It builds a local image with only
`NODE_VERSION=22` overridden, verifies its runtime, and removes its test tag.
It does not publish an image.
