// TODO this should be moved to ent-passport or something like that
import passport from "passport";
import { Auth, AuthViewer } from "./index";
import { Viewer } from "src/ent";
import { IncomingMessage, ServerResponse } from "http";
import { Strategy } from "passport-strategy";
import { Context } from "./context";
import { ID, Ent } from "../ent";

export interface PassportAuthOptions {
  serializeViewer?(viewer: Viewer): unknown;
  deserializeViewer?(id: unknown): Viewer;
  reqUserToViewer?(user: any): Viewer;
}

// TODO need something better here
class IDViewer implements Viewer {
  constructor(public viewerID: ID, private ent: Ent | null = null) {}
  async viewer() {
    return this.ent;
  }
  instanceKey(): string {
    return `idViewer: ${this.viewerID}`;
  }
}

export class PassportAuthHandler implements Auth {
  private options: PassportAuthOptions | undefined;
  constructor(options?: PassportAuthOptions) {
    this.options = options;
  }

  async authViewer(request: IncomingMessage, response: ServerResponse) {
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
          return new IDViewer(id);
        };
      }

      done(null, deserializeUser(id));
    });

    console.log("passport auth handler");
    let user = request["user"];
    console.log(user);
    if (!user) {
      return null;
    }
    // valid viewer!
    if ((user as Viewer).viewerID !== undefined) {
      return user;
    }
    if (this.options?.reqUserToViewer) {
      return this.options.reqUserToViewer(user);
    }
    throw new Error("cannot convert req.user to a Viewer");
  }
}

interface LocalStrategyOptions {
  // email or username
  emailAddress: string;
  password: string;
  verifyFn?: (
    emailAddress: string,
    password: string,
  ) => AuthViewer | Promise<AuthViewer>;
}

export class LocalStrategy extends Strategy {
  name = "ent-local";
  constructor(private options: LocalStrategyOptions) {
    super();
  }

  async authenticate(req: IncomingMessage): Promise<AuthViewer> {
    if (this.options.verifyFn) {
      let viewer = await this.options.verifyFn(
        this.options.emailAddress,
        this.options.password,
      );
      console.log("auth viewer", viewer);
      // we actually want the logged in viewer here
      if (viewer) {
        this.success(viewer);
        return viewer;
      } else {
        this.fail(401); // todo
        return null;
      }
    }
    console.log("local strategy authenticate called");
    return null;
  }
}

function promisified(context: Context, strategy: passport.Strategy) {
  return new Promise<AuthViewer>((resolve, reject) => {
    const done = (err: Error, user) => {
      console.log("done", err, user);
      if (err) {
        reject(err);
      } else {
        console.log(user);
        // TODO args to resolve
        resolve(user);
      }
    };
    let authMethod = passport.authenticate(strategy.name!);
    return authMethod(context.request, context.response, done);
  });
}

export async function useAndAuth(
  context: Context,
  strategy: passport.Strategy,
) {
  if (!strategy.name) {
    throw new Error("name required for strategy");
  }
  passport.use(strategy);
  let result = await promisified(context, strategy);

  console.log("useAndAuth", result, context.request["user"]);
}
