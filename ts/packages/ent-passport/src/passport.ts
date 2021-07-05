import passport, { AuthenticateOptions } from "passport";
import {
  AuthHandler,
  AuthViewer,
  registerAuthHandler,
} from "@snowtop/ent/auth";
import { IncomingMessage } from "http";
import { Strategy } from "passport-strategy";
import {
  Ent,
  ID,
  loadEnt,
  LoadEntOptions,
  Viewer,
  RequestContext,
  IDViewer,
  loadEntX,
} from "@snowtop/ent";
import {
  ExtractJwt,
  JwtFromRequestFunction,
  StrategyOptions,
  VerifyCallback,
  Strategy as JWTStrategy,
} from "passport-jwt";
import jwt from "jsonwebtoken";
import { Express } from "express";
import session from "express-session";

interface UserToViewerFunc {
  (context: RequestContext, user: any): Viewer | Promise<Viewer>;
}

export interface PassportAuthOptions {
  serializeViewer?(viewer: Viewer): unknown;
  deserializeViewer?(id: unknown): Promise<Viewer> | Viewer;
  userToViewer?: UserToViewerFunc;
  loadOptions?: LoadEntOptions<Ent>; // helpful when userToViewer not passed
}

// should this be renamed to session?
export class PassportAuthHandler implements AuthHandler {
  private options: PassportAuthOptions | undefined;
  constructor(options?: PassportAuthOptions) {
    this.options = options;
  }

  async authViewer(context: RequestContext) {
    let that = this;
    passport.serializeUser(function (viewer: Viewer, done) {
      let serializeUser = that.options?.serializeViewer;
      if (!serializeUser) {
        serializeUser = (viewer: Viewer) => {
          return viewer.viewerID;
        };
      }

      done(null, serializeUser!(viewer));
    });

    passport.deserializeUser(function (id: unknown, done) {
      let deserializeUser = that.options?.deserializeViewer;
      if (!deserializeUser) {
        deserializeUser = async (id: ID) => {
          if (that.options?.loadOptions) {
            let ent = await loadEntX(
              new IDViewer(id, { context }),
              id,
              that.options.loadOptions,
            );
            return new IDViewer(id, { context, ent });
          }
          return new IDViewer({ viewerID: id, context });
        };
      }

      done(null, deserializeUser(id));
    });

    let user = context.request["user"];
    if (!user) {
      return null;
    }
    let userr = await user;
    return await toViewer(context, userr, this.options?.userToViewer);
  }

  static testInitSessionBasedFunction(
    secret: string,
    options?: PassportAuthOptions,
  ) {
    return (app: Express) => {
      app.use(
        session({
          secret: secret,
        }),
      );
      app.use(passport.initialize());
      app.use(passport.session());
      registerAuthHandler("viewer", new PassportAuthHandler(options));
    };
  }
}

async function toViewer(
  context: RequestContext,
  obj: any,
  userToViewer?: UserToViewerFunc,
): Promise<Viewer> {
  if ((obj as Viewer).viewerID !== undefined) {
    return obj;
  }
  if (userToViewer) {
    return await userToViewer(context, obj);
  }

  throw new Error("cannot convert to Viewer");
}

// passportstrategyhandler
// to be used for other requests when JWT is passed

function defaultReqToViewer(loadOptions?: LoadEntOptions<Ent>) {
  return async (context: RequestContext, viewerID: string | ID) => {
    let ent: Ent | null = null;
    if (loadOptions) {
      ent = await loadEnt(
        new IDViewer(viewerID, { context }),
        viewerID,
        loadOptions,
      );
    }
    return new IDViewer(viewerID, { context, ent: ent });
  };
}

export class PassportStrategyHandler implements AuthHandler {
  constructor(
    private strategy: passport.Strategy,
    private options?: AuthenticateOptions,
    private reqToViewer?: UserToViewerFunc,
  ) {
    if (!this.strategy.name) {
      throw new Error("name required for strategy");
    }
    passport.use(strategy);
  }

  async authViewer(context: RequestContext) {
    //    console.log("passport authViewer", context.getViewer());
    const viewerMaybe = await promisifiedAuth(
      context,
      this.strategy,
      this.options,
    );

    if (!viewerMaybe) {
      return null;
    }

    const viewer = await toViewer(context, viewerMaybe, this.reqToViewer);
    // needed to pass viewer to auth
    await context.authViewer(viewer);
    return viewer;
  }

  static jwtHandler(opts: JwtHandlerOptions) {
    let strategyOpts: StrategyOptions;
    if (opts.strategyOpts) {
      strategyOpts = opts.strategyOpts;
    } else {
      if (!opts.secretOrKey) {
        throw new Error(
          `must provide secretOrKey if strategyOpts not proivded`,
        );
      }
      strategyOpts = {
        secretOrKey: opts.secretOrKey,
        jwtFromRequest:
          opts.jwtFromRequest || ExtractJwt.fromAuthHeaderAsBearerToken(),
      };
    }

    let reqToViewer: UserToViewerFunc =
      opts.reqToViewer || defaultReqToViewer(opts.loaderOptions);

    return new PassportStrategyHandler(
      new JWTStrategy(strategyOpts, function (jwt_payload: {}, next) {
        return next(null, jwt_payload["viewerID"].toString(), {});
      }),
      opts.authOptions,
      reqToViewer,
    );
  }

  static testInitJWTFunction(opts: JwtHandlerOptions) {
    return (app: Express) => {
      app.use(passport.initialize());
      registerAuthHandler("viewer", PassportStrategyHandler.jwtHandler(opts));
    };
  }
}

interface JwtHandlerOptions {
  loaderOptions?: LoadEntOptions<Ent>;
  authOptions?: AuthenticateOptions;
  verifyFn?: VerifyCallback; // if not provided, a default one which takes viewerID from payload is used
  strategyOpts?: StrategyOptions;
  secretOrKey?: string | Buffer; // if strategyOpts not provided, can just pass this and we'd pass this along with ExtractJwt.fromAuthHeaderAsBearerToken to take it from request
  jwtFromRequest?: JwtFromRequestFunction;
  reqToViewer?: UserToViewerFunc;
}

interface LocalStrategyOptions {
  verifyFn: (context?: RequestContext) => AuthViewer | Promise<AuthViewer>;
}

export class LocalStrategy extends Strategy {
  name = "ent-local";
  constructor(private options: LocalStrategyOptions) {
    super();
  }

  async authenticate(_req: IncomingMessage): Promise<AuthViewer> {
    //console.log("local strategy authenticate called");
    let viewer = await this.options.verifyFn();
    //console.log("auth viewer", viewer);
    // we actually want the logged in viewer here
    if (viewer) {
      this.success(viewer);
      return viewer;
    } else {
      this.fail(401); // TODO
      return null;
    }
  }
}

function promisifiedAuth(
  context: RequestContext,
  strategy: passport.Strategy,
  options?: AuthenticateOptions,
) {
  return new Promise<AuthViewer>((resolve, reject) => {
    const done = (err: Error, user: Viewer | null, _info: any) => {
      //console.log("done", err, user);
      if (err) {
        reject(err);
      } else {
        resolve(user);
      }
    };
    options = options || {};
    let authMethod = passport.authenticate(strategy.name!, options, done);
    return authMethod(
      context.request,
      context.response,
      (err?: Error | null) => {
        console.error("err", err);
      },
    );
  });
}

function promisifiedLogin(
  context: RequestContext,
  viewer: Viewer,
  options?: AuthenticateOptions,
) {
  if (typeof context.request["login"] !== "function") {
    return null;
  }

  return new Promise<void>((resolve, reject) => {
    const done = (err: Error | undefined) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    };
    // log the user in!
    // call the login function
    // need to call it with request as this
    context.request["login"](viewer, options, done);
  });
}

export async function useAndAuth(
  context: RequestContext,
  strategy: passport.Strategy,
  options?: AuthenticateOptions,
): Promise<AuthViewer> {
  if (!strategy.name) {
    throw new Error("name required for strategy");
  }
  passport.use(strategy);
  let viewer = await promisifiedAuth(context, strategy, options);

  if (!viewer) {
    return viewer;
  }
  // auth the viewer with context
  await context.authViewer(viewer);

  // login the user to passport
  await promisifiedLogin(context, viewer, options);

  // console.log("useAndAuth", viewer);
  return viewer;
}

export async function useAndVerifyAuth(
  context: RequestContext,
  verifyFn: () => Promise<Viewer | ID | null>,
  loadOptions?: LoadEntOptions<Ent>,
  options?: AuthenticateOptions,
): Promise<AuthViewer> {
  const strategy = new LocalStrategy({
    verifyFn: async (ctx: RequestContext) => {
      const viewerMaybe = await verifyFn();
      if (!viewerMaybe) {
        return null;
      }
      return await toViewer(
        context,
        viewerMaybe,
        defaultReqToViewer(loadOptions),
      );
    },
  });

  return await useAndAuth(context, strategy, options);
}

interface JWTOptions {
  viewerToPayload?: (v: Viewer) => string | object | Buffer;
  secretOrKey: jwt.Secret;
  signInOptions?: jwt.SignOptions;
}

export function defaultViewerToPayload(viewer: Viewer): {} {
  if (!viewer.viewerID) {
    return {};
  }
  return { viewerID: viewer.viewerID.toString() };
}

export async function useAndVerifyAuthJWT(
  context: RequestContext,
  verifyFn: () => Promise<ID | Viewer | null>,
  jwtOptions: JWTOptions,
  loadOptions?: LoadEntOptions<Ent>,
  options?: AuthenticateOptions,
): Promise<[AuthViewer, string]> {
  const viewer = await useAndVerifyAuth(
    context,
    verifyFn,
    loadOptions,
    options,
  );

  if (!viewer || !viewer.viewerID) {
    throw new Error(`invalid login credentials`);
  }

  let payload: string | object | Buffer;
  if (jwtOptions.viewerToPayload) {
    payload = jwtOptions.viewerToPayload(viewer);
  } else {
    payload = defaultViewerToPayload(viewer);
  }

  const token = jwt.sign(payload, jwtOptions.secretOrKey, {
    // may eventually want to provide way to customize subject but not right now
    subject: viewer.viewerID.toString(),
    ...jwtOptions.signInOptions,
  });
  return [viewer, token];
}
