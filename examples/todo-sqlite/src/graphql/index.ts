import express from "express";
import {
  getGraphQLParameters,
  processRequest,
  ExecutionContext,
  sendResult,
  shouldRenderGraphiQL,
  renderGraphiQL,
} from "graphql-helix";
import { DB } from "@snowtop/ent";
import { buildContext } from "@snowtop/ent/auth";
import schema from "./generated/schema";

let app = express();
app.use(express.json());
app.use("/graphql", async (req, res) => {
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
});
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
