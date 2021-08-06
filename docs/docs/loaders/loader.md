---
sidebar_position: 1
sidebar_label: "Loader"
---

# Loader

Loader is the core primitive of data fetching used by the framework. It's used by the generated code to fetch data and retrieve from the [context cache](/docs/core-concepts/context-caching) as needed.

This section is only relevant when writing [custom queries](/docs/custom-queries/custom-queries) or to peek under the hood to figure out how things work.

The Loader API looks like this:

```ts
export interface Loader<T, V> {
  context?: Context;
  load(key: T): Promise<V>;
  clearAll(): any;
}
```

Most Loaders use [DataLoader](https://github.com/graphql/dataloader) to fetch data but that's an implementation detail. The Loader API is agnostic to how data is fetched and if it's cached. 

## LoaderFactory

As the name suggests, `LoaderFactory` is a factory instance used to create Loaders. Because we cache data on a per-request basis, we create a new instance of `Loader` for each new request as needed.

API looks like:

```ts
export interface LoaderFactory<T, V> {
  name: string; // used to have a per-request cache of each loader type

  // when context is passed, there's potentially opportunities to batch data in the same
  // request
  // when no context is passed, no batching possible (except with explicit call to loadMany API)
  createLoader(context?: Context): Loader<T, V>;
}
```
