import express from "express";
import graphqlHTTP from "express-graphql";
import User from "src/ent/user";
import Contact from "src/ent/contact";
import Event from "src/ent/event";
import { IDViewer } from "src/util/id_viewer";

import { GraphQLSchema } from "graphql";

import { userType } from "./resolvers/user_type";
import { contactType } from "./resolvers/contact_type";
import { eventType } from "./resolvers/event_type";
import { queryType } from "./resolvers/query_type";
import { mutationType } from "./mutations/mutation_type";
import {
  userCreateInputType,
  userCreateResponseType,
} from "./mutations/user/create_user";
import {
  userEditInput,
  userEditResponseType,
} from "./mutations/user/edit_user";
import {
  userDeleteInput,
  userDeleteResponseType,
} from "./mutations/user/delete_user";

const schema = new GraphQLSchema({
  query: queryType,
  mutation: mutationType,
  // can't find a value for this yet. GraphiQl doesn't need it...
  // maybe introspection or something of the sort?
  // don't need this??
  // when would we want types that are not inherently referenced by Query or Mutation?
  // all types...
  // types: [
  //   userType,
  //   eventType,
  //   contactType,
  //   userCreateInputType,
  //   userCreateResponseType,
  //   userEditInput,
  //   userEditResponseType,
  //   userDeleteInput,
  //   userDeleteResponseType,
  // ],
});

var app = express();

app.use(
  "/graphql",
  graphqlHTTP({
    schema: schema,
    graphiql: true,
    context: {
      //viewer: new LoggedOutViewer(),
      viewer: new IDViewer("e0fba30e-8bc3-4d0d-b574-903cd6772d16"),
    },
  }),
);
app.listen(4000);
console.log("yay!");
