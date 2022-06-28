import express from "express";
import { graphqlHTTP } from "express-graphql";
import { IncomingMessage, ServerResponse } from "http";
import { buildContext, registerAuthHandler } from "@snowtop/ent/auth";
import { PassportStrategyHandler } from "@snowtop/ent-passport";
import passport from "passport";
import cors, { CorsOptions, CorsOptionsDelegate } from "cors";
import { graphqlUploadExpress } from "graphql-upload";
import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";
import { config } from "dotenv";
import { DB, loadConfig } from "@snowtop/ent";
// this line fixes the issue by loading ent first but we need to do that consistently everywhere
import { User } from "src/ent";
import schema from "./generated/schema";

// load env
config();
loadConfig("ent.yml");

let app = express();

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  tracesSampleRate: 1,
  environment: process.env.NODE_ENV || "development",
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

//https://docs.sentry.io/platforms/node/guides/express/

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

const delegagte: CorsOptionsDelegate = function (req, callback) {
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
const r = /(query|mutation) (\w+)/;
app.use(
  "/graphql",
  cors(delegagte),
  graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
  graphqlHTTP((request: IncomingMessage, response: ServerResponse, params) => {
    if (params && params.query) {
      const result = r.exec(params.query);
      if (result) {
        // set the query or mutation name as the sentry transaction name
        //https://docs.sentry.io/platforms/node/guides/express/enriching-events/transaction-name/
        Sentry.configureScope((scope) => scope.setTransactionName(result[2]));
      }
    }
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

process.on("uncaughtException", (err) => {
  console.error("There was an uncaught error", err);
  process.exit(1); //mandatory (as per the Node.js docs)
});

const server = app.listen(process.env.PORT || 4000);

app.get("/healthz", async (req, res, params) => {
  const pool = DB.getInstance().getPool();
  try {
    await pool.query("SELECT now()");
    res.sendStatus(200);
  } catch (err) {
    console.error("error sending health check", err);
    res.sendStatus(403);
  }
});

function handleShutdown(signal: string) {
  server.close(() => {
    console.log("signal", signal);
    DB.getInstance()
      .endPool()
      .then(() => {
        process.exit(0);
      });
  });
}
process.on("SIGTERM", handleShutdown);
process.on("SIGINT", handleShutdown);
process.on("SIGHUP", handleShutdown);

console.log("graphql");
