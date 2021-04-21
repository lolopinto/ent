import express from "express";
import { graphqlHTTP } from "express-graphql";
import { IncomingMessage, ServerResponse } from "http";
import { buildContext, registerAuthHandler } from "@lolopinto/ent/auth";
import { PassportStrategyHandler } from "@lolopinto/ent-passport";
import passport from "passport";
import cors, { CorsOptions, CorsOptionsDelegate } from "cors";
import { graphqlUploadExpress } from "graphql-upload";
import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";
import { config } from "dotenv";
import { loadConfig } from "@lolopinto/ent";

// load env
config();
loadConfig("ent.yml");

let app = express();

// this line fixes the issue by loading ent first but we need to do that consistently everywhere
import { User } from "src/ent";
import schema from "./schema";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Tracing.Integrations.Express({
      // to trace all requests to the default router
      app,
      // alternatively, you can specify the routes you want to trace:
      // router: someRouter,
    }),
  ],
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

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

app.use(Sentry.Handlers.errorHandler());

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
