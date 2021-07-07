---
sidebar_position: 6
---

# Context Caching

To speed up applications, we end up caching data in memory to avoid repeated trips to the database. Since we create a [new `Context` per request](/docs/core-concepts/context#new-request), we depend on the context cache (if available).

```ts
// hits database
const user = await User.loadX(viewer, id);
// hits cache
const user2 = await User.loadX(viewer, id);
```

For example, in the above, we will only hit the database once to load the data for the id.

As the request gets a lot more complicated, we see significant savings here since we could end up saving a lot of trips to the database.

We use [DataLoader](https://github.com/graphql/dataloader) to batch and cache queries.

We'll dive deeper into how we handle queries later.

By default, all queries have context, learn more [here](/docs/core-concepts/context#new-request).

## clearing the cache

Anytime there's a write to the database, we clear the *entire* cache. It's possible there are clever things we can do to selectively clear the cache but that's not currently happening.

```ts
// hits database
const user = await User.loadX(viewer, id);
// hits cache
const user2 = await User.loadX(viewer, id);
// perform some write
await CreateFooAction.create(vc, input).saveX()

// hits datbase
const user3 = await User.loadX(viewer, id);
```

## no context

If the `Viewer` has no context, all queries hit the database.

```ts
// vc. no context
const vc = new LoggedOutViewer();
// hits database
const user = await User.loadX(vc, id);
// hits database
const user2 = await User.loadX(vc, id);
```
