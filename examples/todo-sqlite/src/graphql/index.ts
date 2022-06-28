import express from "express";
import { graphqlHTTP } from "express-graphql";
import { IncomingMessage, ServerResponse } from "http";
import { DB } from "@snowtop/ent";
import { buildContext } from "@snowtop/ent/auth";
import schema from "./generated/schema";

let app = express();

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
