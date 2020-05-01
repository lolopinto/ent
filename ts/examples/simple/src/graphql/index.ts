import express from "express";
import graphqlHTTP from "express-graphql";
import User, { AccountStatus } from "src/ent/user";
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

const accountStatusEnum = new GraphQLEnumType({
  name: "ACCOUNT_STATUS",
  values: {
    UNVERIFIED: {
      value: "UNVERIFIED",
      description: "unverified account",
    },
    VERIFIED: {
      value: "VERIFIED",
      description: "verified account",
    },
    DEACTIVATED: {
      value: "DEACTIVATED",
      description: "deactivated account",
    },
    DISABLED: {
      value: "DISABLED",
      description: "disabled account",
    },
  },
});

const userType = new GraphQLObjectType({
  name: "User",
  description: "User",
  fields: () => ({
    id: {
      type: GraphQLNonNull(GraphQLID),
      description: "id",
    },
    firstName: {
      type: GraphQLNonNull(GraphQLString),
      description: "first name",
    },
    lastName: {
      type: GraphQLNonNull(GraphQLString),
      description: "last name",
    },
    emailAddress: {
      type: GraphQLNonNull(GraphQLString),
      description: "emailAddress",
    },
    accountStatus: {
      type: accountStatusEnum,
      description: "account status",
    },
  }),
});

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
      resolve: async (_source, { id }) => {
        return User.load(
          new IDViewer("e0fba30e-8bc3-4d0d-b574-903cd6772d16"),
          "e0fba30e-8bc3-4d0d-b574-903cd6772d16",
        );
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
  }),
);
app.listen(4000);
console.log("yay!");
