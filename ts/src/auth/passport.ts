// TODO this should be moved to ent-passport or something like that
import passport from "passport";
import { Auth, AuthViewer } from "./index";
import { Viewer } from "src/ent";
import { IncomingMessage, ServerResponse } from "http";
import { Strategy } from "passport-strategy";

// boo
// export class EntPassport implements Auth {
//   constructor(public strategy: passport.Strategy) {
//     console.log("passport constructor");
//     if (!this.strategy.name) {
//       throw new Error("strategy name required");
//     }
//     passport.use(strategy);
//   }

//   // damn this needs to return logged in user not create the user
//   async authViewer(
//     request: IncomingMessage,
//     response: ServerResponse,
//   ): Promise<Viewer | null> {
//     console.log("authViewer");

//     //    passport.authenticate(this.strategy.name!);
//     return null;
//   }
// }

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
