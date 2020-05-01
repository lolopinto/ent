import express from "express";
import graphqlHTTP from "express-graphql";
import User, { AccountStatus } from "src/ent/user";
import Contact from "src/ent/contact";
import { IDViewer } from "src/util/id_viewer";
import { ID } from "ent/ent";

import {
  //  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLEnumType,
  GraphQLNonNull,
} from "graphql";

import { userType } from "./resolvers/user";
import { contactType } from "./resolvers/contact";
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

const queryType = new GraphQLObjectType({
  name: "Query",
  fields: () => ({
    user: {
      type: userType,
      args: {
        id: {
          description: "id",
          type: GraphQLID,
        },
      },
      // src, args, context, info
      resolve: async (_source, { id }, context, info) => {
        //console.log(_source); // undefined
        console.log("sss");
        //console.log(context); // viewer
        //console.log(id); // args
        //console.log(info); //all the things
        return User.load(context.viewer, id);
      },
    },
    contact: {
      type: contactType,
      args: {
        id: {
          description: "id",
          type: GraphQLID,
        },
      },
      resolve: async (_source, { id }, context) => {
        return Contact.load(context.viewer, id);
      },
    },
  }),
});

const schema = new GraphQLSchema({
  query: queryType,
  types: [userType],
});

var app = express();

app.use(
  "/graphql",
  graphqlHTTP({
    schema: schema,
    graphiql: true,
    context: {
      viewer: new IDViewer("e0fba30e-8bc3-4d0d-b574-903cd6772d16"),
    },
  }),
);
app.listen(4000);
console.log("yay!");
