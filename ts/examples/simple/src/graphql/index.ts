import express from "express";
import graphqlHTTP from "express-graphql";

import schema from "./schema";
import { IncomingMessage, ServerResponse } from "http";
import { registerAuthHandler } from "ent/auth";
import passport from "passport";
import session from "express-session";
import { buildContext } from "ent/auth/context";
import { PassportAuthHandler } from "ent/auth/passport";

let app = express();
app.use(
  session({
    secret: "ss",
  }),
);
app.use(passport.initialize());
app.use(passport.session());

registerAuthHandler("viewer", new PassportAuthHandler());

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
