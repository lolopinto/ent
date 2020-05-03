import User from "src/ent/user";
import Contact from "src/ent/contact";
import Event from "src/ent/event";

import { GraphQLObjectType, GraphQLID } from "graphql";

import { userQuery } from "./user_type";
import { contactQuery } from "./contact_type";
import { eventQuery } from "./event_type";

export const queryType = new GraphQLObjectType({
  name: "Query",
  fields: () => ({
    // all of this is what needs to be abstracted away...
    user: userQuery,
    contact: contactQuery,
    event: eventQuery,
  }),
});
