import express from "express";
import { graphqlHTTP } from "express-graphql";
import schema from "./schema";
import { IncomingMessage, ServerResponse } from "http";
import { buildContext } from "@lolopinto/ent/auth";

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
app.listen(4000);
