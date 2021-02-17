import express from "express";
import { graphqlHTTP } from "express-graphql";
import { IncomingMessage, ServerResponse } from "http";
import { buildContext, registerAuthHandler } from "@lolopinto/ent/auth";
import { PassportStrategyHandler } from "@lolopinto/ent-passport";
import passport from "passport";
import cors from "cors";
// this line fixes the issue by loading ent first but we need to do that consistently everywhere
import { User } from "src/ent";
import schema from "./schema";

let app = express();

app.use(passport.initialize());
app.use(cors());

registerAuthHandler(
  "viewer",
  PassportStrategyHandler.jwtHandler({
    secretOrKey: "secret",
    loaderOptions: User.loaderOptions(),
  }),
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
