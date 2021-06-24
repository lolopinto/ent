import express from "express";
import { graphqlHTTP } from "express-graphql";

import schema from "./schema";
import { IncomingMessage, ServerResponse } from "http";
import passport from "passport";
//import session from "express-session";
import { DB } from "@snowtop/snowtop-ts";
import { buildContext, registerAuthHandler } from "@snowtop/snowtop-ts/auth";
import {
  //  PassportAuthHandler,
  PassportStrategyHandler,
} from "@snowtop/snowtop-passport";
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

function handleShutdown(signal) {
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
