import express from "express";
import {
  getGraphQLParameters,
  processRequest,
  ExecutionContext,
  sendResult,
  shouldRenderGraphiQL,
  renderGraphiQL,
} from "graphql-helix";
import schema from "./generated/schema";
import passport from "passport";
import session from "express-session";
import { DB } from "@snowtop/ent";
import { buildContext, registerAuthHandler } from "@snowtop/ent/auth";
import {
  PassportAuthHandler,
  PassportStrategyHandler,
} from "@snowtop/ent-passport";
import { graphqlUploadExpress } from "graphql-upload";
import { User } from "../ent";

let app = express();
app.use(express.json());
app.use(
  session({
    secret: "ss",
  }),
);
app.use(passport.initialize());
// session and PassportAuthHandler for non-JWT flows
app.use(passport.session());

registerAuthHandler("passportViewer", new PassportAuthHandler());
registerAuthHandler(
  "jwtViewer",
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
  async (req, res) => {
    if (shouldRenderGraphiQL(req)) {
      res.send(renderGraphiQL());
    } else {
      const { operationName, query, variables } = getGraphQLParameters(req);
      const result = await processRequest({
        operationName,
        query,
        variables,
        request: req,
        schema,
        contextFactory: async (executionContext: ExecutionContext) => {
          return buildContext(req, res);
        },
      });
      await sendResult(result, res);
    }
  },
);
const server = app.listen(process.env.port || 4000);

app.get("/healthz", async (req, res, params) => {
  try {
    const pool = DB.getInstance().getPool();
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
