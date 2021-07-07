---
sidebar_position: 2
---

# Context

Context is a simple object that represents, well, the context of what's happening.

```ts
export interface Context {
  getViewer(): Viewer;

  cache?: cache;
}
```

There's the simple `Context` interface shown above which has a `getViewer` method which returns the [`Viewer`](/docs/core-concepts/viewer) and a `cache` property which is used for [context-caching](/docs/core-concepts/context-caching).

## RequestContext

There's also the `RequestContext` interface which is used during the request-path e.g. in GraphQL queries and mutations:

```ts
export interface RequestContext extends Context {
  authViewer(viewer: Viewer): Promise<void>; 
  logout(): Promise<void>;
  request: IncomingMessage;
  response: ServerResponse;
}
```

### authViewer

`authViewer` is used to change who the currently logged in `Viewer` is. It's called by the built-in [auth](/docs/core-concepts/authentication) to change the viewer from the previous one -often the [LoggedOutViewer](/docs/core-concepts/viewer#loggedoutviewer) - to the newly logged in `Viewer`.

### logout

Changes the viewer to the [LoggedOutViewer](/docs/core-concepts/viewer#loggedoutviewer).

### request

Instance of HTTP [Request](https://nodejs.org/api/http.html#http_class_http_incomingmessage) object.

### response

Instance of HTTP [Response](https://nodejs.org/api/http.html#http_class_http_serverresponse) object.

## New Request

It's highly recommended that a new `Context` is created for each new request. The framework comes with a helper method `buildContext` which helps with this. It takes the `request` and `response` above and returns a new [`RequestContext`](#requestcontext). It calls into the [auth](/docs/core-concepts/authentication) system to ensure the right `Viewer` is returned.

Since we implement [context-caching](/docs/core-concepts/context-caching), we want to make sure that any data cached in one request is not inadvertently served incorrectly in a different request.

The default generated GraphQL handler helps with that:

```ts title="src/graphql/index.ts"
//...
app.use(
  "/graphql",
  graphqlHTTP((request: IncomingMessage, response: ServerResponse) => {
    let doWork = async () => {
      let context = await buildContext(request, response);
      return {
        schema: schema,
        graphiql: true,
        context,
      };
    };
    return doWork();
  }),
);
```

This is an [express](https://github.com/expressjs/express) handler which uses `graphqlHTTP` from [express-graphql](https://github.com/graphql/express-graphql), builds the `context` via `buildContext` and that context is passed all the way down to each GraphQL resolver.

All of the above can be overriden or changed as needed if your needs are more complicated. The `src/graphql/index.ts` file is generated only once.
