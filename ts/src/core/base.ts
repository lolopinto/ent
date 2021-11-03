import * as clause from "./clause";

// Loader is the primitive data fetching abstraction in the framework
// implementation details up to each instance
// A DataLoader could be used internally or not.
// For Loaders that use DataLoader, there's batching done to fetch multiple pieces
// of information.
// Using Loader and LoaderFactory allows us to use the same instance of Loader across a
// request and potentially batch data as needed when possible
export interface Loader<T, V> {
  context?: Context;
  load(key: T): Promise<V>;
  // TODO we need a loadMany() API similar to DataLoaer
  // what's the plural api to be?
  loadMany?(keys: T[]): Promise<(V | null)[]>;
  clearAll(): any;
}

// A LoaderFactory is used to create a Loader
// We cache data on a per-request basis therefore for each new request, createLoader
// is called to get a new instance of Loader which will then be used to load data as needed
export interface LoaderFactory<T, V> {
  name: string; // used to have a per-request cache of each loader type

  // factory method.
  // when context is passed, there's potentially opportunities to batch data in the same
  // request
  // when no context is passed, no batching possible (except with explicit call to loadMany API)
  createLoader(context?: Context): Loader<T, V>;
}

// better name for this?
// this is used by EntQuery and then smart decision is made of what to do
export interface ConfigurableLoaderFactory<T, V> extends LoaderFactory<T, V> {
  createConfigurableLoader(
    options: EdgeQueryableDataOptions,
    context?: Context,
  ): Loader<T, V>;
}

export type EdgeQueryableDataOptions = Partial<
  Pick<QueryableDataOptions, "limit" | "orderby" | "clause">
>;

// PrimableLoader allows us to prime data in the cache that's retrieved from
// other sources
export interface PrimableLoader<T, V> extends Loader<T, V> {
  prime(d: Data): void;
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

  // TODO expose this? use
  cache?: cache;
}

export interface Viewer {
  viewerID: ID | null;
  viewer: () => Promise<Ent | null>;
  instanceKey: () => string;
  //  isOmniscient?(): boolean; // optional function to indicate a viewer that can see anything e.g. admin
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
  new (viewer: Viewer, data: Data): T;
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

export interface SelectBaseDataOptions extends DataOptions {
  // list of fields to read
  fields: string[];
}

export interface SelectDataOptions extends SelectBaseDataOptions {
  // primary key we're selecting from most often 'id'
  key: string;
}

export interface QueryableDataOptions
  extends SelectBaseDataOptions,
    QueryDataOptions {}

export interface QueryDataOptions {
  distinct?: boolean;
  clause: clause.Clause;
  orderby?: string; // this technically doesn't make sense when querying just one row but whatevs
  groupby?: string;
  limit?: number;
}

// For loading data from database
export interface LoadRowOptions extends QueryableDataOptions {}

export interface LoadRowsOptions extends QueryableDataOptions {}

export interface CreateRowOptions extends DataOptions {
  // fields to be edited
  fields: Data;
  fieldsToLog?: Data;
}

export interface EditRowOptions extends CreateRowOptions {
  key: string; // what key are we loading from. if not provided we're loading from column "id"
}

interface LoadableEntOptions<T extends Ent> {
  loaderFactory: LoaderFactory<any, Data | null>;
  ent: EntConstructor<T>;
}

// information needed to load an ent from the databse
export interface LoadEntOptions<T extends Ent>
  extends LoadableEntOptions<T>,
    // extending DataOptions and fields is to make APIs like loadEntsFromClause work until we come up with a cleaner API
    SelectBaseDataOptions {}

export interface LoadCustomEntOptions<T extends Ent>
  // extending DataOptions and fields is to make APIs like loadEntsFromClause work until we come up with a cleaner API
  extends SelectBaseDataOptions {
  ent: EntConstructor<T>;
}

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

const allow: PrivacyResult = {
  result: privacyResult.Allow,
};

export function Allow(): PrivacyResult {
  return allow;
}

const skip: PrivacyResult = {
  result: privacyResult.Skip,
};

export function Skip(): PrivacyResult {
  return skip;
}

const deny: PrivacyResult = {
  result: privacyResult.Deny,
};

export function Deny(): PrivacyResult {
  return deny;
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
