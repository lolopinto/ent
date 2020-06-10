import express from "express";
import graphqlHTTP from "express-graphql";

import schema from "./schema";
import { IncomingMessage, ServerResponse } from "http";
import { registerAuthHandler } from "ent/auth";
import passport from "passport";
import session from "express-session";
import { buildContext } from "ent/auth/context";
import {
  PassportAuthHandler,
  PassportStrategyHandler,
} from "ent/auth/passport";
import { Strategy as JWTStrategy, ExtractJwt } from "passport-jwt";
import { IDViewer } from "src/util/id_viewer";

let app = express();
// app.use(
//   session({
//     secret: "ss",
//   }),
// );
app.use(passport.initialize());
// session and PassportAuthHandler for non-JWT flows
//app.use(passport.session());

//registerAuthHandler("viewer", new PassportAuthHandler());
registerAuthHandler(
  "viewer",
  new PassportStrategyHandler(
    new JWTStrategy(
      {
        secretOrKey: "secret",
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      },
      function(jwt_payload: {}, next) {
        console.log("jwt payload", jwt_payload);
        return next(null, new IDViewer(jwt_payload.toString()), {});
      },
    ),
    { session: false },
  ),
);

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
app.listen(4000);
console.log("graphql");
