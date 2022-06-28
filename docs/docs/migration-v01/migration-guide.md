---
sidebar_position: 1
sidebar_label: "Migration Guide"
---

# Migration Guide

Ent `v0.1` involves lots of breaking changes from `v0.x`.

Highlights are as follows:

* schema files go from src/schema/foo.ts to src/schema/foo_schema.ts
* new Schema API. instead of list of fields, we have mapping of fields.

```ts
// from
fields: [
  StringType({name: 'foo'}),
  IntegerType({name: 'bar'}),
]

// to
fields: {
  foo: StringType(),
  bar: IntegerType(),
}
```

* update to GraphQL 16 which has different/breaking change API
* more heavily templated objects/fields/etc which means we have stronger typing for things
* change privacy of ents from `privacyPolicy` to `getPrivacyPolicy`
* change triggers, observers, validators to `getTriggers`, `getObservers`, `getValidators`
* `Foo.loadMany` API changes from returning list to Map which is a breaking change
* moving all generated files to `src/ent/generated` and `src/graphql/generated` so easier to see in PRs and VSCode
* enums are now prefixed with schemaName
* and more including lots of TypeScript templating changes.

## Migration steps

* Run tests, `tsc` etc to make sure your schema/codebase is fine.
* Update to latest version of graphql:

```shell
npm install graphql@16.5.0
```

* Update to latest version of `v0.1` ent:

```shell
npm install @snowtop/ent@0.1.0-alpha34
```

* Update to latest version of any `@snowtop/ent-x` dependencies

May need to do all of them at once such as:

```shell
yarn add graphql@16.5.0 @snowtop/ent@0.1.0-alpha34 @snowtop/ent-email@0.1.0-alpha1 @snowtop/ent-graphql-tests@0.1.0-alpha3 --force
```

* If using a custom base class that's not `BaseEntSchema` or `BaseEntSchemaWithTZ`, implement your new version of the class, we'll pass that to a migration script later.

* Remove the `.ent` file 

```shell
rm -rf .ent
```

* pull latest version of docker image

```shell
docker pull ghcr.io/lolopinto/ent:0.1.0-alpha.4-nodejs-17-dev
```

* Update `develop.Dockerfile` and/or `Dockerfile` to get the latest docker image.
* Rebuild the docker image

```shell
npm run rebuild-image
```

* Commit your changes so you can easily see/revert migration changes:

```shell
git commit --all -m "stash"
```

* Run the migration script:
  * If no custom base schema class:

    ```shell
      docker-compose -f docker-compose.dev.yml run --rm app tsent migrate_v0.1
    ```

  * If custom base schema class

    ```shell
    docker-compose -f docker-compose.dev.yml run --rm app tsent migrate_v0.1 --old_base_class BaseFooSchema --new_schema_class FooSchema  --transform_path ./base
    ```

* If no errors, commit your changes

```shell
git add . && git commit --all -m "migration changes"
```

* Fix rest of your custom code until `tsc` is happy and tests pass

* If there were errors in the migration path, file a bug or see if there's anything you need to change in your code to make things work.
