import * as clause from "./clause";
import { ObjectLoaderFactory } from "./loaders";
import { OrderBy } from "./query_impl";

// Loader is the primitive data fetching abstraction in the framework
// implementation details up to each instance
// A DataLoader could be used internally or not.
// For Loaders that use DataLoader, there's batching done to fetch multiple pieces
// of information.
// Using Loader and LoaderFactory allows us to use the same instance of Loader across a
// request and potentially batch data as needed when possible
export interface Loader<K, V> {
  context?: Context;
  load(key: K): Promise<V>;
  // TODO we need a loadMany() API similar to DataLoaer
  // what's the plural api to be?
  loadMany?(keys: K[]): Promise<(V | null)[]>;
  clearAll(): any;
}

export interface LoaderWithLoadMany<T, V> extends Loader<T, V> {
  loadMany(keys: T[]): Promise<V[]>;
}

// A LoaderFactory is used to create a Loader
// We cache data on a per-request basis therefore for each new request, createLoader
// is called to get a new instance of Loader which will then be used to load data as needed
export interface LoaderFactory<K, V> {
  name: string; // used to have a per-request cache of each loader type

  // factory method.
  // when context is passed, there's potentially opportunities to batch data in the same
  // request
  // when no context is passed, no batching possible (except with explicit call to loadMany API)
  createLoader(context?: Context): Loader<K, V>;
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
  Pick<
    QueryableDataOptions,
    "limit" | "orderby" | "clause" | "disableTransformations"
  >
>;

export type EdgeQueryableDataOptionsConfigureLoader = Pick<
  EdgeQueryableDataOptions,
  "disableTransformations"
>;

// PrimableLoader allows us to prime data in the cache that's retrieved from
// other sources
export interface PrimableLoader<K, V> extends Loader<K, V> {
  prime(d: V): void;
  // prime this loader and any other loader it's aware of
  primeAll?(d: V): void;
}

export type QueryOptions = Required<
  Pick<LoadRowsOptions, "clause" | "fields" | "tableName">
> &
  Pick<LoadRowsOptions, "orderby" | "join">;

interface cache {
  getLoader<K, V>(name: string, create: () => Loader<K, V>): Loader<K, V>;
  getLoaderWithLoadMany<K, V>(
    name: string,
    create: () => LoaderWithLoadMany<K, V>,
  ): LoaderWithLoadMany<K, V>;
  getCachedRows(options: QueryOptions): Data[] | null;
  getCachedRow(options: QueryOptions): Data | null;
  primeCache(options: QueryOptions, rows: Data[]): void;
  primeCache(options: QueryOptions, rows: Data): void;
  clearCache(): void;
  reset(): void;
}

export interface Context<TViewer extends Viewer = Viewer> {
  // TODO https://github.com/lolopinto/ent/pull/1658
  // if we ever make Context required, as part of that breaking change add reset()
  // method so that we can reset the context for long-running "requests" like websockets
  // and that'll be the official API/way of doing this
  // TODO https://github.com/lolopinto/ent/issues/1576
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
  // used to set raw data that's then used by ent internals
  // shouldn't be used...
  __setRawDBData<T extends Data = Data>(data: T);
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
  // rename table as alias
  alias?: string;

  // TODO remove this from here since we're changing how this works....
  context?: Context;
}

export interface SelectBaseDataOptions extends DataOptions {
  // list of fields to read
  fields: string[];
  // use this alias to alias the fields instead of the table name or table alias
  // takes precedence over tableName and alias
  fieldsAlias?: string;
}

export interface SelectDataOptions extends SelectBaseDataOptions {
  // primary key we're selecting from most often 'id'
  key: string;
  // if postgres and using an integer primary key, we need to pass this so that when we do an In query,
  // we can cast accurately
  // TODO https://github.com/lolopinto/ent/issues/1431
  keyType?: string; // 'uuid' | 'integer' etc...
  // if exists, we and with the primary key query
  clause?: clause.Clause | (() => clause.Clause | undefined);
}

export interface QueryableDataOptions
  extends SelectBaseDataOptions,
    QueryDataOptions {}

// for now, no complicated joins. just simple joins
interface JoinOptions<T2 extends Data = Data, K2 = keyof T2> {
  tableName: string;
  alias?: string;
  clause: clause.Clause<T2, K2>;
}

export interface QueryDataOptions<T extends Data = Data, K = keyof T> {
  distinct?: boolean;
  clause: clause.Clause<T, K>;
  orderby?: OrderBy; // this technically doesn't make sense when querying just one row but whatevs
  groupby?: K;
  limit?: number;
  disableTransformations?: boolean;
  join?: JoinOptions[];
}

// For loading data from database
export interface LoadRowOptions extends QueryableDataOptions {}

export interface LoadRowsOptions extends QueryableDataOptions {}

interface OnConflictOptions {
  // TODO these should change to fields instead of columns
  onConflictCols: string[];

  // onConflictConstraint doesn't work with do nothing since ent always reloads the
  // row after insert and if there's no conflict columns provided, we have no way of querying
  // the db for the original/conflicting row
  onConflictConstraint?: string;
  // update values based on fields
  // if not provided, we do nothing
  updateCols?: string[];
}

export interface CreateRowOptions extends DataOptions {
  // fields to be edited
  fields: Data;
  fieldsToLog?: Data;
  onConflict?: OnConflictOptions;
}

export interface EditRowOptions extends Omit<CreateRowOptions, "onConflict"> {
  whereClause: clause.Clause;
  // if a column exists in here as opposed to in fields, we use the expression given
  // instead of the value
  expressions?: Map<string, clause.Clause>;
}

interface LoadableEntOptions<
  TEnt extends Ent,
  TViewer extends Viewer = Viewer,
  TData extends Data = Data,
> {
  loaderFactory: ObjectLoaderFactory<TData>;
  ent: EntConstructor<TEnt, TViewer>;
}

export interface LoaderFactoryWithOptions<T extends Data = Data>
  extends LoaderFactoryWithLoaderMany<any, T | null> {
  options?: SelectDataOptions;
}

// information needed to load an ent from the databse
export interface LoadEntOptions<
  TEnt extends Ent,
  TViewer extends Viewer = Viewer,
  TData extends Data = Data,
> extends LoadableEntOptions<TEnt, TViewer, TData>,
    // extending DataOptions and fields is to make APIs like loadEntsFromClause work until we come up with a cleaner API
    SelectBaseDataOptions {
  // if passed in, it means there's field privacy on the ents *and* we want to apply it at ent load
  // if there's field privacy on the ent and not passed in, it'll be applied on demand when we try and load the ent
  fieldPrivacy?: Map<string, PrivacyPolicy>;
}

export interface SelectCustomDataOptions<T extends Data = Data>
  extends SelectBaseDataOptions {
  // main loader factory for the ent, passed in for priming the data so subsequent fetches of this id don't reload
  loaderFactory: ObjectLoaderFactory<T>;

  // should we prime the ent after loading. uses loaderFactory above
  // only pass prime if the fields is equivalent to the ids of the other loader factory
  // it doesn't check...
  prime?: boolean;
}

export interface LoadCustomEntOptions<
    TEnt extends Ent,
    TViewer extends Viewer = Viewer,
    TData extends Data = Data,
  >
  // extending DataOptions and fields is to make APIs like loadEntsFromClause work until we come up with a cleaner API
  extends SelectCustomDataOptions<TData> {
  ent: EntConstructor<TEnt, TViewer>;
  fieldPrivacy?: Map<string, PrivacyPolicy>;
}

export interface LoaderInfo<T = Data> {
  tableName: string;
  fields: string[];
  nodeType: string;
  loaderFactory: LoaderFactory<ID, T | null>;
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

export enum WriteOperation {
  Insert = "insert",
  Edit = "edit",
  Delete = "delete",
}
