---
sidebar_position: 5
---

# Authentication

Authentication is a very complicated topic and we're not going to dive too deep into all that it entails here.

Assuming you've chosen an authentication system and want to figure out how to integrate your authed user into this system, here's how you do it.

## AuthHandler

```ts
export type AuthViewer = Viewer | null;
export interface AuthHandler {
    authViewer(ctx: RequestContext): AuthViewer | Promise<AuthViewer>;
}
```

AuthHandler takes a [`RequestContext`](/docs/core-concepts/context#requestcontext) and returns a `Viewer` or `null` if that handler can successfully authenticate the Viewer.

## registerAuthHandler

```ts
export declare function registerAuthHandler(name: string, auth: Auth): Promise<void>;
```

Each `AuthHandler` should be registered via `registerAuthHandler`. You can register as many as you need as long as they have a unique name.

Note that `registerAuthHandler` should be called at the root of your application (presumably in the same file as your server such as `src/graphql/index.ts`). If your handler successfully authenticates a `Viewer`, that Viewer is returned as the `Viewer` in the `Context` returned by [`buildContext`](/docs/core-concepts/context#new-request).

## passport-integration

There's a sample package [ent-passport](https://github.com/lolopinto/ent/tree/main/ts/packages/ent-passport) which uses [passport](http://www.passportjs.org/) as a proof of concept to show how this might work.

```ts title="src/graphql/index.ts"
// JWT. authenticate via Bearer token
registerAuthHandler(
  "viewer",
  PassportStrategyHandler.jwtHandler({
    secretOrKey: "secret",
    authOptions: {
      session: false,
    },
    loaderOptions: User.loaderOptions(),
  }),
);

// session based
app.use(
  session({
    secret: "ss",
  }),
);
app.use(passport.initialize());
// session and PassportAuthHandler for non-JWT flows
app.use(passport.session());
// authenticate via session
registerAuthHandler("viewer", new PassportAuthHandler());

```

And the `Viewer` is authenticated in an endpoint with that same package via

```ts title="src/graphql/mutations/auth.ts"
  // non-JWT. session based
  const viewer = await useAndVerifyAuth(
    context,
    async () => {
      const data = await User.validateEmailPassword(
        input.emailAddress,
        input.password,
      );
      return data?.id;
    },
    User.loaderOptions(),
  );
  // return whatever you want to client

  // JWT
  const [viewer, token] = await useAndVerifyAuthJWT(
    context,
    async () => {
      const data = await User.validateEmailPassword(
        input.emailAddress,
        input.password,
      );
      return data?.id;
    },
    {
      secretOrKey: "secret",
      signInOptions: {
        algorithm: "HS256",
        audience: "https://foo.com/website",
        issuer: "https://foo.com",
        expiresIn: "1h",
      },
    },
    User.loaderOptions(),
    // don't store this in session since we're using JWT here
    {
      session: false,
    },
  );
  // return whatever you want to client
```
