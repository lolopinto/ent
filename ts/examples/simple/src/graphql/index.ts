import express from "express";
import graphqlHTTP from "express-graphql";
import { IDViewer } from "src/util/id_viewer";

import schema from "./schema";
import { IncomingMessage, ServerResponse } from "http";
import { getLoggedInViewer, registerAuthHandler } from "ent/auth";
import passport from "passport";
//import { LocalStrategy } from "ent/auth/passport";
import { Viewer } from "ent/ent";
import { ID } from "ent/ent";
import session from "express-session";

//import { EntPassport } from "ent/auth/passport";
let app = express();
app.use(
  session({
    secret: "ss",
  }),
);
app.use(passport.initialize());
app.use(passport.session());

registerAuthHandler("viewer", {
  authViewer: async (request, response) => {
    passport.serializeUser(function(viewer: Viewer, done) {
      console.log("serialize", viewer, done);
      // TODO configurable
      done(null, viewer.viewerID);
    });

    passport.deserializeUser(function(id: ID, done) {
      console.log("deserialize", id, done);

      // TODO configurable
      done(null, new IDViewer(id));
    });

    console.log("passport auth handler");
    // need the list of possible things here?
    //    let user = await passport.authorize("ent-local");
    let user = request["user"];
    console.log(user);
    if (!user) {
      return null;
    }
    console.log(user);
    //    console.log("authorized", user, request.user);
    return user;
    //this should be a passport thing but need local strategy to work first
    //    return null;
    // console.log(request);
    // console.log(response);
    //    return new IDViewer("a9e74a57-498c-40da-a65b-c8cba203cc1d");
  },
});

// test
// passport.use(
//   new LocalStrategy({
//     emailAddress: "",
//     password: "",
//   }),
// );
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
          request,
          response,
        },
      };
    };
    return doWork();
  }),
);
app.listen(4000);
console.log("graphql");
