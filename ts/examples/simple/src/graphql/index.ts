import express from "express";
import graphqlHTTP from "express-graphql";
import { IDViewer } from "src/util/id_viewer";

import schema from "./schema";
import { IncomingMessage, ServerResponse } from "http";
import { getLoggedInViewer, registerAuthHandler } from "ent/auth";
let app = express();

registerAuthHandler("viewer", {
  authViewer: (request, response) => {
    console.log(request);
    console.log(response);
    return new IDViewer("a9e74a57-498c-40da-a65b-c8cba203cc1d");
  },
});

app.use(
  "/graphql",
  graphqlHTTP((request: IncomingMessage, response: ServerResponse) => {
    let doWork = async () => {
      let viewer = await getLoggedInViewer(request, response);
      return {
        schema: schema,
        graphiql: true,
        context: {
          viewer,
        },
      };
    };
    return doWork();
  }),
);
app.listen(4000);
console.log("graphql");
