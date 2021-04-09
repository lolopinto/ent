import express from "express";
import { graphqlHTTP } from "express-graphql";
import { IncomingMessage, ServerResponse } from "http";
import { buildContext, registerAuthHandler } from "@lolopinto/ent/auth";
import { PassportStrategyHandler } from "@lolopinto/ent-passport";
import passport from "passport";
import cors, { CorsOptions, CorsOptionsDelegate } from "cors";
import { GraphQLUpload, graphqlUploadExpress } from "graphql-upload";

// this line fixes the issue by loading ent first but we need to do that consistently everywhere
import { User } from "src/ent";
import schema from "./schema";

let app = express();
app.disable("x-powered-by");

app.use(passport.initialize());
registerAuthHandler(
  "viewer",
  PassportStrategyHandler.jwtHandler({
    secretOrKey: "secret",
    loaderOptions: User.loaderOptions(),
  }),
);

const delegagte: CorsOptionsDelegate = function(req, callback) {
  const corsOptions: CorsOptions = {
    origin: req.headers.origin || "*",
    methods: ["POST", "OPTIONS", "GET", "DELETE", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Content-Length",
      "Authorization",
      "Accept",
      "Accept-Encoding",
      "Accept-Language",
    ],
    maxAge: -1,
  };
  callback(null, corsOptions);
};

app.options("/graphql", cors(delegagte));

app.use(
  "/graphql",
  cors(delegagte),
  graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
  graphqlHTTP((request: IncomingMessage, response: ServerResponse, params) => {
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
app.listen(process.env.PORT || 4000);
console.log("graphql");
