import * as clause from "./clause";

export interface LoaderFactory<T, V> {
  name: string; // used to have a per-request cache of each loader type

  // having Context here as opposed to fetch can mean we have different loaders if we care about Context
  // or it can just be completely ignored!
  createLoader(context?: Context): Loader<T, V>;
}

// TODO better name for this
// this is used by entquery
// and then smart decision is made of what to do

export interface ConfigurableLoaderFactory<T, V> extends LoaderFactory<T, V> {
  createConfigurableLoader(
    options: EdgeQueryableDataOptions,
    context?: Context,
  ): Loader<T, V>;
}

export type EdgeQueryableDataOptions = Partial<
  Pick<QueryableDataOptions, "limit" | "orderby" | "clause">
>;

export interface Loader<T, V> {
  context?: Context;
  // maybe Context will be used to make different decisions
  load(key: T): Promise<V>;
  // what's the plural api to be?
  loadMany?(keys: T[]): Promise<(V | null)[]>;
  clearAll(): any;
  // TODO we need a loadMany() API similar to DataLoaer
}

interface cache {
  getLoader<T, V>(name: string, create: () => Loader<T, V>): Loader<T, V>;
  getCachedRows(options: queryOptions): Data[] | null;
  getCachedRow(options: queryOptions): Data | null;
  primeCache(options: queryOptions, rows: Data[]): void;
  primeCache(options: queryOptions, rows: Data): void;
  clearCache(): void;
}
interface queryOptions {
  fields: string[];
  tableName: string;
  clause: clause.Clause;
  orderby?: string;
}

export interface Context {
  getViewer(): Viewer;
  // optional per (request)contet
  // absence means we are not doing any caching
  // presence means we have loader, ent cache etc

  // TODO
  cache?: cache;
}

export interface Viewer {
  viewerID: ID | null;
  viewer: () => Promise<Ent | null>;
  instanceKey: () => string;
  isOmniscient?(): boolean; // optional function to indicate a viewer that can see anything e.g. admin
  // TODO determine if we want this here.
  // just helpful to have it here
  // not providing a default AllowIfOmniRule

  // where should dataloaders be put?
  // I want dataloaders to be created on demand as needed
  // so it seems having it in Context (per-request info makes sense)
  // so does that mean we should pass Context all the way down and not Viewer?
  context?: Context;
}

export interface Ent {
  id: ID;
  viewer: Viewer;
  privacyPolicy: PrivacyPolicy;
  nodeType: string;
}

export declare type Data = {
  [key: string]: any;
};

export interface EntConstructor<T extends Ent> {
  new (viewer: Viewer, id: ID, options: Data): T;
}

export type ID = string | number;

export interface DataOptions {
  // TODO pool or client later since we should get it from there
  // TODO this can be passed in for scenarios where we are not using default configuration
  //  clientConfig?: ClientConfig;
  tableName: string;

  // TODO remove this from here since we're changing how this works....
  context?: Context;
}

export interface SelectDataOptions extends DataOptions {
  // list of fields to read
  fields: string[];
  pkey?: string; // what key are we loading from. if not provided we're loading from column "id"
}

export interface QueryableDataOptions extends SelectDataOptions {
  distinct?: boolean;
  clause: clause.Clause;
  orderby?: string; // this technically doesn't make sense when querying just one row but whatevs
  groupby?: string;
  limit?: number;
}

// For loading data from database
export interface LoadRowOptions extends QueryableDataOptions {
  //  pkey?: string; // what key are we loading from. if not provided we're loading from column "id"
}

export interface LoadRowsOptions extends QueryableDataOptions {}

export interface EditRowOptions extends DataOptions {
  // fields to be edited
  fields: Data;
  fieldsToLog?: Data;
  pkey?: string; // what key are we loading from. if not provided we're loading from column "id"
}

interface LoadableEntOptions<T extends Ent> extends DataOptions {
  loaderFactory: LoaderFactory<ID, Data>;
  ent: EntConstructor<T>;
}

// information needed to load an ent from the databse
// always id for now...
export interface LoadEntOptions<T extends Ent>
  extends LoadableEntOptions<T>,
    SelectDataOptions {}

// information needed to edit an ent
export interface EditEntOptions<T extends Ent>
  extends LoadableEntOptions<T>,
    EditRowOptions {}

// Privacy
enum privacyResult {
  // using http status codes similar to golang for the lols
  Allow = 200,
  Deny = 401,
  Skip = 307,
}

export interface PrivacyResult {
  result: privacyResult;
  error?: PrivacyError;
}

export interface PrivacyError extends Error {
  privacyPolicy: PrivacyPolicy;
  ent?: Ent;
}

export function Allow(): PrivacyResult {
  return {
    result: privacyResult.Allow,
  };
}

export function Skip(): PrivacyResult {
  return {
    result: privacyResult.Skip,
  };
}

export function Deny(): PrivacyResult {
  return {
    result: privacyResult.Deny,
  };
}

export function DenyWithReason(e: PrivacyError): PrivacyResult {
  return {
    result: privacyResult.Deny,
    error: e,
  };
}

export interface PrivacyPolicyRule {
  apply(v: Viewer, ent?: Ent): Promise<PrivacyResult>;
}

// export interface PrivacyPolicyRuleSync {
//   apply(v: Viewer, ent: Ent): PrivacyResult;
// }

export interface PrivacyPolicy {
  //  rules: PrivacyPolicyRule | PrivacyPolicyRuleSync[];
  rules: PrivacyPolicyRule[];
}
