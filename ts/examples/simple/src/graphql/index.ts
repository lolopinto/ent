import express from "express";
import graphqlHTTP from "express-graphql";
import User from "src/ent/user";
import Contact from "src/ent/contact";
import Event from "src/ent/event";
import { IDViewer } from "src/util/id_viewer";

import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLEnumType,
  GraphQLNonNull,
} from "graphql";

import { userType } from "./resolvers/user_type";
import { contactType } from "./resolvers/contact_type";
import { eventType } from "./resolvers/event_type";
import { queryType } from "./resolvers/query_type";
import { mutationType } from "./mutations/mutation_type";

// code to generate this and read from it, not hard since I already have this...
// let schema = buildSchema(`
// type Query {
//   user(id: ID) User
// }

// type User {
//   id: ID!
//   firstName: String!
//   lastName: String!
//   emailAddress:String!
// }`);

const schema = new GraphQLSchema({
  query: queryType,
  mutation: mutationType,
  // don't need this??
  // when would we want types that are not inherently referenced by Query or Mutation?
  //  types: [userType, eventType],
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
