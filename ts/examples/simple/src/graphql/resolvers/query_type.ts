import User from "src/ent/user";
import Contact from "src/ent/contact";
import Event from "src/ent/event";

import { GraphQLObjectType, GraphQLID } from "graphql";

import { userType } from "./user_type";
import { contactType } from "./contact_type";
import { eventType } from "./event_type";

export const queryType = new GraphQLObjectType({
  name: "Query",
  fields: () => ({
    // all of this is what needs to be abstracted away...
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
    event: {
      type: eventType,
      args: {
        id: {
          description: "id",
          type: GraphQLID,
        },
      },
      resolve: async (_source, { id }, context) => {
        return Event.load(context.viewer, id);
      },
    },
  }),
});
