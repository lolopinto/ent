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

interface LoaderWithLoadMany<T, V> extends Loader<T, V> {
  loadMany(keys: T[]): Promise<(V | null)[]>;
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

interface LoaderFactoryWithLoaderMany<T, V> extends LoaderFactory<T, V> {
  createLoader(context?: Context): LoaderWithLoadMany<T, V>;
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
  // prime this loader and any other loader it's aware of
  primeAll?(d: Data): void;
}

interface cache {
  getLoader<T, V>(name: string, create: () => Loader<T, V>): Loader<T, V>;
  getCachedRows(options: queryOptions): Data[] | null;
  getCachedRow(options: queryOptions): Data | null;
  primeCache(options: queryOptions, rows: Data[]): void;
  primeCache(options: queryOptions, rows: Data): void;
  clearCache(): void;
  getEntCache(): Map<string, Ent | Error | null>;
}
interface queryOptions {
  fields: string[];
  tableName: string;
  clause: clause.Clause;
  orderby?: string;
}

export interface Context<TViewer extends Viewer = Viewer> {
  getViewer(): TViewer;
  // optional per (request)contet
  // absence means we are not doing any caching
  // presence means we have loader, ent cache etc

  // TODO expose this? use
  cache?: cache;
}

export interface Viewer<
  TEnt extends any = Ent<any> | null,
  TID extends any = ID | null,
> {
  viewerID: TID;
  viewer: () => Promise<TEnt>;
  instanceKey: () => string;
  //  isOmniscient?(): boolean; // optional function to indicate a viewer that can see anything e.g. admin
  // TODO determine if we want this here.
  // just helpful to have it here
  // not providing a default AllowIfOmniRule

  // where should dataloaders be put?
  // I want dataloaders to be created on demand as needed
  // so it seems having it in Context (per-request info makes sense)
  // so does that mean we should pass Context all the way down and not Viewer?
  context?: Context<any>;
}

export interface Ent<TViewer extends Viewer = Viewer> {
  id: ID;
  viewer: TViewer;
  getPrivacyPolicy(): PrivacyPolicy<this, TViewer>;
  nodeType: string;
}

export declare type Data = {
  [key: string]: any;
};

export interface EntConstructor<
  TEnt extends Ent,
  TViewer extends Viewer = Viewer,
> {
  new (viewer: TViewer, data: Data): TEnt;
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
  // if exists, we and with the primary key query
  clause?: clause.Clause | (() => clause.Clause | undefined);
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
  disableTransformations?: boolean;
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
  whereClause: clause.Clause;
}

interface LoadableEntOptions<
  TEnt extends Ent,
  TViewer extends Viewer = Viewer,
> {
  loaderFactory: LoaderFactoryWithOptions;
  ent: EntConstructor<TEnt, TViewer>;
}

interface LoaderFactoryWithOptions
  extends LoaderFactoryWithLoaderMany<any, Data | null> {
  options?: SelectDataOptions;
}

// information needed to load an ent from the databse
export interface LoadEntOptions<
  TEnt extends Ent,
  TViewer extends Viewer = Viewer,
> extends LoadableEntOptions<TEnt, TViewer>,
    // extending DataOptions and fields is to make APIs like loadEntsFromClause work until we come up with a cleaner API
    SelectBaseDataOptions {
  // if passed in, it means there's field privacy on the ents *and* we want to apply it at ent load
  // if there's field privacy on the ent and not passed in, it'll be applied on demand when we try and load the ent
  fieldPrivacy?: Map<string, PrivacyPolicy>;
}

export interface SelectCustomDataOptions extends SelectBaseDataOptions {
  // defaultClause that's added to the query. automatically added
  // TODO kill the tests testing for this.
  // only in loaderFactory
  // clause?: clause.Clause;

  // main loader factory for the ent, passed in for priming the data so subsequent fetches of this id don't reload
  // only pass prime if we load all the data

  loaderFactory: LoaderFactoryWithOptions;

  // should we prime the ent after loading. uses loaderFactory above
  prime?: boolean;
}

export interface LoadCustomEntOptions<
    TEnt extends Ent,
    TViewer extends Viewer = Viewer,
  >
  // extending DataOptions and fields is to make APIs like loadEntsFromClause work until we come up with a cleaner API
  extends SelectCustomDataOptions {
  ent: EntConstructor<TEnt, TViewer>;
  fieldPrivacy?: Map<string, PrivacyPolicy>;
}

export interface LoaderInfo {
  tableName: string;
  fields: string[];
  nodeType: string;
  loaderFactory: LoaderFactory<any, Data | null>;
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
  getError?(
    policy: PrivacyPolicy,
    rule: PrivacyPolicyRule,
    ent?: Ent,
  ): PrivacyError;
}

export interface PrivacyError extends Error {
  privacyPolicy: PrivacyPolicy<Ent>;
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

class DenyWithReasonError extends Error implements PrivacyError {
  privacyPolicy: PrivacyPolicy;
  privacyRule: PrivacyPolicyRule;
  ent?: Ent;

  constructor(
    privacyPolicy: PrivacyPolicy,
    rule: PrivacyPolicyRule,
    msg: string,
    ent?: Ent,
  ) {
    super(msg);
    this.privacyPolicy = privacyPolicy;
    this.privacyRule = rule;
    this.ent = ent;
  }
}

export function DenyWithReason(e: PrivacyError | string): PrivacyResult {
  if (typeof e === "string") {
    return {
      result: privacyResult.Deny,
      getError(policy: PrivacyPolicy, rule: PrivacyPolicyRule, ent?: Ent) {
        return new DenyWithReasonError(policy, rule, e, ent);
      },
    };
  }
  return {
    result: privacyResult.Deny,
    error: e,
  };
}

export interface PrivacyPolicyRule<TEnt extends Ent = Ent, TViewer = Viewer> {
  apply(v: TViewer, ent?: TEnt): Promise<PrivacyResult>;
}

export interface PrivacyPolicy<TEnt extends Ent = Ent, TViewer = Viewer> {
  rules: PrivacyPolicyRule<TEnt, TViewer>[];
}
