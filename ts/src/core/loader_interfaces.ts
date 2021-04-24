import { Context } from "./context";
export interface LoaderFactory<T, V> {
  name: string; // used to have a per-request cache of each loader type

  // having Context here as opposed to fetch can mean we have different loaders if we care about Context
  // or it can just be completely ignored!
  createLoader(context?: Context): Loader<T, V>;
}

export interface Loader<T, V> {
  context?: Context;
  // maybe Context will be used to make different decisions
  load(key: T): Promise<V>;
}
