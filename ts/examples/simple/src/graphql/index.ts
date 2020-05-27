import express from "express";
import graphqlHTTP from "express-graphql";
import { IDViewer } from "src/util/id_viewer";

import schema from "./schema";

let app = express();

app.use(
  "/graphql",
  graphqlHTTP({
    schema: schema,
    graphiql: true,
    context: {
      //viewer: new LoggedOutViewer(),
      viewer: new IDViewer("a9e74a57-498c-40da-a65b-c8cba203cc1d"),
    },
  }),
);
app.listen(4000);
console.log("graphql");
