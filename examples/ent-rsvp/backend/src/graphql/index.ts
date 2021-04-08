import express from "express";
import { graphqlHTTP } from "express-graphql";
import { IncomingMessage, ServerResponse } from "http";
import { buildContext, registerAuthHandler } from "@lolopinto/ent/auth";
import { PassportStrategyHandler } from "@lolopinto/ent-passport";
import passport from "passport";
import cors, { CorsOptions } from "cors";
import { GraphQLUpload, graphqlUploadExpress } from "graphql-upload";

// this line fixes the issue by loading ent first but we need to do that consistently everywhere
import { User } from "src/ent";
import schema from "./schema";

let app = express();
app.use(passport.initialize());
registerAuthHandler(
  "viewer",
  PassportStrategyHandler.jwtHandler({
    secretOrKey: "secret",
    loaderOptions: User.loaderOptions(),
  }),
);

const corsOptions: CorsOptions = {
  origin: "*",
  methods: "POST, GET, OPTIONS, DELETE",
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "Accept-Encoding",
    "Accept-Language",
    "Content-Length",
    "X-CSRF-Token",
  ],
  maxAge: 86400,
};
app.options("/graphql", cors(corsOptions));

app.post(
  "/graphql",
  cors(corsOptions),
  graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
  graphqlHTTP((request: IncomingMessage, response: ServerResponse, params) => {
    //    console.log("params", params);
    let doWork = async () => {
      let context = await buildContext(request, response);
      //      console.log(context, schema);
      return {
        schema: schema,
        graphiql: true,
        context,
        //        pretty: true,
      };
    };
    // console.log(request.headers, request.method);
    // console.log(response.getHeaders());
    return doWork();
  }),
);
app.listen(process.env.PORT || 4000);
console.log("graphql");
