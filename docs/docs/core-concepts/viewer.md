---
sidebar_position: 1
---

# Viewer

Viewer represents *who's* viewing the content in your product or app. Every time data is loaded or changed, the Viewer is required to determine if that action can be performed.

Viewer is just an interface that can easily be implemented by any object and is not tied to any implementation or authentication mechanism.

Here's what the Viewer interface looks like:

```ts
interface Viewer {
  viewerID: ID | null;
  viewer: () => Promise<Ent | null>;
  instanceKey: () => string;
  context?: Context;
}
```

## viewerID

The `viewerID` indicates a unique identifier, usually the id in the database of the User or Account that's associated with whoever's logged in.

## viewer

The `viewer` method returns the [`Ent`](/docs/core-concepts/ent) associated with the logged in user or `null` if there's no logged in viewer.

## instanceKey

The `instanceKey` returns a unique identifier associated with this `Viewer`. It may be used to perform caching to save requests to the database.

## context

The `context` returns the [`Context`](/docs/core-concepts/context) associated with the "request".

## LoggedOutViewer

The framework comes with a simple `Viewer` to represent the logged out viewer. It's the default Viewer used if none is provided. It can be instantiated as follows:

```ts
const vc1 = new LoggedOutViewer();
const vc2 = new LoggedOutViewer(context);
```

## IDViewer

There's also a simple IDViewer which takes the viewerID and can be used for simple projects. It can be instantiated as follows:

```ts
const vc1 = new IDViewer(id);
// both context and ent are optional below:
// if provided, context satisfies the `context` requirement in the Viewer interface
// if provided, ent satisfies the `viewer` requirement in the Viewer interface
const vc2 = new IDViewer(id, {context: context, ent: user});
const vc3 = new IDViewer({viewerID: id, context: context, ent: user});
```
