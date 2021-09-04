---
sidebar_position: 4
sidebar_label: "Configuration"
---

# Configuration

There's both codegen and runtime configuration of the ent framework.

## codegen

codegen can be configured in a yml file in order of precedence (from the root of the project):

* a `ent.yml` file
* a `src/ent.yml` file
* a `src/graphql/ent.yml` file

The root of codegen configuration is the `codegen` key in the file.

The following properties can be configured:

* `defaultEntPolicy` configures the [Privacy Policy](/docs/core-concepts/privacy-policy) in base class of generated Ents. Overrides the [default privacy policy](/docs/core-concepts/ent#privacypolicy). See [PrivacyConfig](#privacyConfig) for the expected format.
* `defaultActionPolicy` configures the [Privacy Policy](/docs/core-concepts/privacy-policy) in base class of generated Actions. Overrides the [default privacy policy](/docs/actions/action#default-privacy-policy). See [PrivacyConfig](#privacyConfig) for the expected format.
* `prettier` configures [prettier](https://prettier.io/).
We currently use prettier to format the entire codebase after codegen to ensure a consistent format in the generated files. If you already have a prettier configuration or want to override the glob passed to prettier (default is `src/ent/**/*.ts`), use this option. See [PrettierConfig](#prettierConfig) for the expected format.

### PrivacyConfig

Following fields supported:

* `policyName` (string. required). name of default privacy policy
* `path` (string. required). path to import to get the policy 
* `class` (boolean. optional). indicates if the policy is a class as opposed to a constant.

### PrettierConfig

Following fields supported:

* `custom` (boolean. optional). indicates there's already a [custom prettier configuration](https://prettier.io/docs/en/configuration.html) that should be used. Depends on prettier finding the configuration
* `glob` (string. optional). glob to pass to prettier instead of default `src/ent/**/*.ts`

## runtime

Because there could be so many possible entrypoints into the framework e.g. GraphQL endpoint, REST API endpoint, tests, migration script, etc, there's no way to automatically configure runtime behavior so it has to be done manually via calling `loadConfig`.

### loadConfig

loadConfig takes an optional file, Buffer or `Config`. If nothing is passed, it assumes local `ent.yml` file, if string is passed, it assumes yml file and attempts to read and parse it.

```ts
loadConfig(file?: string | Buffer | Config): void;

type logType = "query" | "warn" | "info" | "error" | "debug";

export interface Database {
  database?: string;
  user?: string;
  password?: string;
  host?: string;
  port?: number;
  ssl?: boolean;
  sslmode?: string;
}

export type env = "production" | "test" | "development";
export declare type DBDict = Partial<Record<env, Database>>;

export interface Config {
  dbConnectionString?: string; // raw db connection string
  dbFile?: string; // config/database.yml is default
  db?: Database | DBDict;
  log?: logType | logType[]; // logging levels.

  // config for codegen. not relevant when loadConfig is called but have it here for posterity
  codegen?: CodegenConfig;
}

interface CodegenConfig {
  defaultEntPolicy?: PrivacyConfig;
  defaultActionPolicy?: PrivacyConfig;
  prettier?: PrettierConfig;
}

interface PrettierConfig {
  custom?: boolean;
  // default glob is 'src/**/*.ts', can override this
  glob?: string;
}

interface PrivacyConfig {
  path: string; // e.g. "@snowtop/ent"
  policyName: string; // e.g. "AlwaysAllowPrivacyPolicy";
  class?: boolean;
}
```

## Example

```yml title="ent.yml"
log:
  - query
  - error
  - warn
  - info
codegen:
  defaultEntPolicy:
    path: "@snowtop/ent"
    policyName: "AlwaysAllowPrivacyPolicy"
  defaultActionPolicy:
    path: '@snowtop/ent'
    policyName: 'AlwaysAllowPrivacyPolicy'
  prettier:
    custom: true
```