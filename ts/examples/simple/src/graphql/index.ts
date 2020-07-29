import express from "express";
import graphqlHTTP from "express-graphql";

import schema from "./schema";
import { IncomingMessage, ServerResponse } from "http";
import { registerAuthHandler } from "ent/auth";
import { IDViewer } from "ent/core/viewer";
import passport from "passport";
import session from "express-session";
import { buildContext } from "ent/auth/context";
import {
  PassportAuthHandler,
  PassportStrategyHandler,
} from "ent/auth/passport";
import { Strategy as JWTStrategy, ExtractJwt } from "passport-jwt";

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
        // apparently issuer, audience, algos not required
        // for HS256 ones
        // issuer: "https://foo.com",
        // audience: "https://foo.com/website",
        // algorithms: ["HS256"],
        secretOrKey: "secret",
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        // jsonWebTokenOptions: {
        //   algorithms: ["HS256"],
        //   audience: "https://foo.com/website",
        //   issuer: "https://foo.com",
        // },
      },
      function(jwt_payload: {}, next) {
        // console.log("jwt payload", jwt_payload);
        return next(null, jwt_payload["viewerID"].toString(), {});
      },
    ),
    { session: false },
    function(context, viewerID) {
      // toViewer method
      return new IDViewer(viewerID, { context });
    },
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
