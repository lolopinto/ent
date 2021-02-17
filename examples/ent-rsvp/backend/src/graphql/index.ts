import express from "express";
import { graphqlHTTP } from "express-graphql";
import schema from "./schema";
import { IncomingMessage, ServerResponse } from "http";
import { buildContext, registerAuthHandler } from "@lolopinto/ent/auth";
import { PassportStrategyHandler } from "@lolopinto/ent-passport";
import passport from "passport";
import { Strategy as JWTStrategy, ExtractJwt } from "passport-jwt";
import { IDViewer } from "@lolopinto/ent";
import cors from "cors";

let app = express();

app.use(passport.initialize());
app.use(cors());

registerAuthHandler(
  "viewer",
  new PassportStrategyHandler(
    new JWTStrategy(
      {
        secretOrKey: "secret",
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      },
      function(jwt_payload: {}, next) {
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
