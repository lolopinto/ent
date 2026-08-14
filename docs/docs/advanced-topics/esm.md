---
sidebar_position: 7
sidebar_label: "ESM and CommonJS"
draft: true
---

# ESM and CommonJS compatibility

Ent is distributed as one native ECMAScript-module graph. Both ESM `import`
and supported CommonJS `require()` calls resolve those same files, so an
application cannot split Ent's mutable registries, caches, database
configuration, or GraphQL capture state across parallel builds.

Synchronous `require()` needs a Node release where unflagged `require(esm)` is
available: Node 20.19.x, Node 22.12 or later, or a later major release. Node 21
and Node 22.0 through 22.11 are not supported. The package engine range is
`>=20.19.0 <21 || >=22.12.0`; Node 24 is recommended. Ent's ESM graph does not
use top-level await, because a synchronous CommonJS caller could not load such
a graph.

## Native ESM projects

Use ESM package and TypeScript settings:

```json title="package.json"
{
  "type": "module"
}
```

```json title="tsconfig.json"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

ESM is the codegen default, but recording it explicitly makes the project
contract clear:

```yml title="ent.yml"
moduleFormat: esm
```

Generated relative imports include runtime `.js` extensions even though the
source files are TypeScript. TypeScript's NodeNext resolver maps those
specifiers back to `.ts` while compiling, and Node receives valid ESM paths in
the emitted JavaScript.

After changing formats, rerun `tsent codegen --write-all`. Codegen does not
rewrite handwritten or generate-once files. In particular, existing projects
must update `src/ent/index.ts`, `src/graphql/index.ts`, and
`src/graphql/resolvers/index.ts`, along with their other handwritten files. Add
`.js` to relative imports and replace directory imports with explicit
`index.js` paths. Then run the emitted JavaScript under Node; a typecheck,
codegen run, or Jest pass alone does not prove that Node can resolve the
compiled graph.

## CommonJS compatibility

Existing projects can remain CommonJS while upgrading Ent. Set all three parts
of the application contract:

```json title="package.json"
{
  "type": "commonjs"
}
```

The `type` field may instead be omitted.

```json title="tsconfig.json"
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node"
  }
}
```

```yml title="ent.yml"
moduleFormat: commonjs
```

`moduleFormat: commonjs` preserves legacy CommonJS specifier behavior,
including `src/*` aliases unless `codegen.relativeImports` is enabled.
`compilerOptions.module: "commonjs"` is what actually makes TypeScript emit
`require()` calls, and the package type makes Node interpret the emitted `.js`
files as CommonJS. `ent-custom-compiler` validates that the codegen format,
TypeScript emit mode, and package type agree, and rewrites project aliases to
runnable relative `.js` paths.

Ent itself remains native ESM. On a supported Node release, the emitted
application's `require("@snowtop/ent")` loads the same Ent files and mutable
state as `import("@snowtop/ent")`; there is intentionally no second CommonJS
copy.

### `ENT_MODULE_FORMAT`

`ENT_MODULE_FORMAT=esm` or `ENT_MODULE_FORMAT=commonjs` overrides
`moduleFormat` from `ent.yml` for that tooling invocation. The environment
value has the same precedence in Go codegen and `ent-custom-compiler`, and
invalid values fail. It does not alter `package.json` or `tsconfig.json`, so an
override that conflicts with those files fails the compiler contract instead
of silently emitting a mixed-format application. Prefer a committed
`moduleFormat` setting for normal builds and reserve the environment override
for controlled matrix jobs.

### Jest and other test runners

Node's native `require()` supports Ent's ESM graph, but Jest 29 and 30 can
execute CommonJS through a private loader that does not delegate
`require(esm)` to Node. A CommonJS application can keep its production output
in CommonJS while asking `ts-jest` to execute tests as ESM:

```js title="jest.config.cjs"
module.exports = {
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
        },
      },
    ],
  },
};
```

Run Jest with `NODE_OPTIONS=--experimental-vm-modules`. ESM tests must import
`jest` from `@jest/globals`. For module mocks, register
`jest.unstable_mockModule()` before dynamically importing the module under
test. This test-only transform deliberately differs from the production
CommonJS `tsconfig.json`; using `NodeNext` inside a CommonJS-typed package makes
TypeScript emit CommonJS into Jest's ESM sandbox. Whatever test runner you use,
retain a smoke test that executes the compiled application with Node.

Upgrade all first-party companions in the same change:
`@snowtop/ent-email`, `@snowtop/ent-graphql-tests`,
`@snowtop/ent-passport`, `@snowtop/ent-password`,
`@snowtop/ent-pgvector`, `@snowtop/ent-phonenumber`,
`@snowtop/ent-postgis`, and `@snowtop/ent-soft-delete`. Mixing their older
CommonJS releases with native-ESM Ent can reintroduce an unsupported loader
boundary.

## Package subpaths

Use package subpaths without a trailing slash. Stable barrel entrypoints are:

- `@snowtop/ent`
- `@snowtop/ent/action`
- `@snowtop/ent/auth`
- `@snowtop/ent/core/loaders`
- `@snowtop/ent/core/query`
- `@snowtop/ent/graphql`
- `@snowtop/ent/imports`
- `@snowtop/ent/schema`
- `@snowtop/ent/testutils/ent-graphql-tests`
- `@snowtop/ent/testutils/fake_data`

File subpaths that mirror published JavaScript, such as
`@snowtop/ent/core/db`, `@snowtop/ent/core/db.js`, and
`@snowtop/ent/graphql/upload`, are also exported. Directory-like specifiers
must use one of the explicit barrel entrypoints above. The historical
`@snowtop/ent/schema/` path is removed; use `@snowtop/ent/schema`.

## Upgrade and rollout

This migration changes the Node floor and the default generated module format,
so it must ship as a coordinated breaking release of Ent, `tsent`, and all
first-party companion packages, not as a patch to the current release lines.
Use a codegen CLI or Docker image from that same ESM-capable release; do not mix
a new generator with old package artifacts.

Before an existing CommonJS project upgrades dependencies:

1. Upgrade production, CI, and developer runtimes to a supported Node release.
2. Add `moduleFormat: commonjs`, keep `compilerOptions.module: "commonjs"`,
   and omit `"type"` or set `"type": "commonjs"`.
3. Upgrade Ent and every first-party companion package together.
4. Run `tsent codegen --write-all`, typecheck, run tests, and execute the
   compiled CommonJS entrypoint with Node.

To adopt native ESM instead, upgrade Node first, add `"type": "module"`, switch
both TypeScript module settings to `NodeNext`, set `moduleFormat: esm`, migrate
handwritten imports, and run the same write-all and emitted-runtime checks.
Projects that cannot complete either recipe should pin the previous Ent release
line; relying on the new ESM default in an unprepared CommonJS project will
break its next codegen run.

### Maintainer release sequence

This implementation change deliberately preserves the repository's separate
version-bump release process. The source tree still says
`@snowtop/ent@0.2.13` and companion `0.1.0`, which are already-published
versions; it is validated for release but cannot be republished directly.

The follow-up release change must use the next breaking pre-1.0 version lines:
`tsent` v0.4.0, `@snowtop/ent` 0.3.0, and 0.2.0 for all eight companions.
Companion peer ranges must become `>=0.3.0 <0.4.0`, their exact development
dependency must become `0.3.0`, and all locks and maintained-example
dependencies must follow.

Avoid publishing any of this set directly to `latest`. Use this staged order:

1. Publish distinct prerelease versions such as Ent `0.3.0-rc.1` and
   companions `0.2.0-rc.1` under a non-default npm dist-tag such as
   `esm-next`, and tag matching `tsent` `v0.4.0-rc.1`. Do not publish the final
   version numbers during this step; npm versions are immutable. Each RC
   companion must peer on the exact RC core (for example `0.3.0-rc.1`) or an
   explicitly prerelease-aware range such as `>=0.3.0-rc.1 <0.4.0`; the final
   `>=0.3.0 <0.4.0` range does not match an npm prerelease.
2. Validate a clean consumer using only those tagged artifacts, including
   codegen, write-all, TypeScript compile, ESM import, CommonJS require, and
   emitted application execution.
3. After the release-candidate proof passes, publish the final Ent 0.3.0 and
   companion 0.2.0 artifacts once under the non-default tag, with the final
   peer and lock metadata. Do not promote `latest` or tag final `tsent` yet.
4. Repeat the clean-consumer proof against those exact final npm artifacts
   under `esm-next`, and run the final CLI commit against them. Approve that
   commit for the v0.4.0 tag, but leave only v0.4.0-rc.1 discoverable until the
   coordinated cutover.
5. Announce a cross-registry release freeze before creating the final Go tag.
   Tag `tsent` v0.4.0, then prepare the separately authorized Docker release PR
   and stage an image under a non-default image tag. Its release files must
   move `release_image/tsent_version.txt` to v0.4.0 and
   `release_image/docker_version.txt` together; `auto_schema` does not need to
   move for this migration alone. Validate that staged image against the final
   npm artifacts under `esm-next`. A new CLI paired with old Ent fails early
   unless the package declares native-ESM tooling contract 1, so this is the
   fail-closed skew direction while the freeze is active.
6. Promote the staged Docker image, then all eight companions, then Ent 0.3.0
   to their respective `latest` tags in the same controlled window. npm, Go
   tags, and the container registry cannot update transactionally, so a
   literally atomic cutover is unavailable; automated installs must pin exact
   old or new versions, and no unversioned install or Docker pull should be
   recommended during the freeze. Companion-first is also fail-closed: their
   final `>=0.3.0 <0.4.0` peers reject the still-default 0.2.x core during the
   brief interval rather than installing an untested runnable graph. If the
   release tooling cannot publish a staging image without moving `latest`, add
   that capability in the release PR or do not begin the cutover.
7. Verify the Docker digest, every npm dist-tag, and a fresh exact-version
   install before ending the freeze, then update maintained examples to the
   coordinated versions.

The Docker image release remains a separate, explicitly authorized operation,
but it is a prerequisite for the `latest` cutover. Until every final promotion
is complete, consumers should use the coordinated release-candidate tags or
should not upgrade any member of the set in isolation.
