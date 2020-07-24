// TODO this should be moved to ent-passport or something like that
import passport, { AuthenticateOptions } from "passport";
import { Auth, AuthViewer } from "./index";
import { IncomingMessage, ServerResponse, Server } from "http";
import { Strategy } from "passport-strategy";
import { RequestContext } from "./context";
import { ID, Ent, Viewer } from "../ent";

interface UserToViewerFunc {
  (context: RequestContext, user: any): Viewer;
}

export interface PassportAuthOptions {
  serializeViewer?(viewer: Viewer): unknown;
  deserializeViewer?(id: unknown): Viewer;
  userToViewer: UserToViewerFunc;
}

// TODO need something better here
class IDViewer implements Viewer {
  constructor(
    public viewerID: ID,
    public context?: RequestContext,
    private ent: Ent | null = null,
  ) {}
  async viewer() {
    return this.ent;
  }
  instanceKey(): string {
    return `idViewer: ${this.viewerID}`;
  }
}

// should this be renamed to session?
export class PassportAuthHandler implements Auth {
  private options: PassportAuthOptions | undefined;
  constructor(options?: PassportAuthOptions) {
    this.options = options;
  }

  async authViewer(context: RequestContext) {
    let that = this;
    passport.serializeUser(function(viewer: Viewer, done) {
      let serializeUser = that.options?.serializeViewer;
      if (!serializeUser) {
        serializeUser = (viewer: Viewer) => {
          return viewer.viewerID;
        };
      }

      done(null, serializeUser!(viewer));
    });

    passport.deserializeUser(function(id: unknown, done) {
      let deserializeUser = that.options?.deserializeViewer;
      if (!deserializeUser) {
        deserializeUser = (id: ID) => {
          return new IDViewer(id, context);
        };
      }

      done(null, deserializeUser(id));
    });

    //console.log("passport auth handler");
    let user = context.request["user"];
    //console.log("req.user", user);
    if (!user) {
      return null;
    }
    return toViewer(context, user, this.options?.userToViewer);
  }
}

function toViewer(
  context: RequestContext,
  obj: any,
  userToViewer?: UserToViewerFunc,
): Viewer {
  //console.log("viewer", obj);

  if ((obj as Viewer).viewerID !== undefined) {
    return obj;
  }
  if (userToViewer) {
    return userToViewer(context, obj);
  }

  throw new Error("cannot convert to Viewer");
}

// passportstrategyhandler
// to be used for other requests when JWT is passed

export class PassportStrategyHandler implements Auth {
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

    const viewer = toViewer(context, viewerMaybe, this.reqToViewer);
    // needed to pass viewer to auth
    await context.authViewer(viewer);
    return viewer;
  }
}

interface LocalStrategyOptions {
  // hmmmmmmmmmm how to pass Context all the way down?
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
  // request: IncomingMessage,
  // response: ServerResponse,
  strategy: passport.Strategy,
  options?: AuthenticateOptions,
) {
  return new Promise<AuthViewer>((resolve, reject) => {
    const done = (err: Error, user: Viewer | null | undefined, _info: any) => {
      console.log("done", err, user);
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

  console.log("useAndAuth viewer", viewer);
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
