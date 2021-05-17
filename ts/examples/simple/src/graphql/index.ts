import express from "express";
import { graphqlHTTP } from "express-graphql";

import schema from "./schema";
import { IncomingMessage, ServerResponse } from "http";
import passport from "passport";
//import session from "express-session";
import { buildContext, registerAuthHandler } from "@lolopinto/ent/auth";
import {
  //  PassportAuthHandler,
  PassportStrategyHandler,
} from "@lolopinto/ent-passport";
import { graphqlUploadExpress } from "graphql-upload";
import { User } from "src/ent";

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
  PassportStrategyHandler.jwtHandler({
    secretOrKey: "secret",
    authOptions: {
      session: false,
    },
    loaderOptions: User.loaderOptions(),
  }),
);

app.use(
  "/graphql",
  graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
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
