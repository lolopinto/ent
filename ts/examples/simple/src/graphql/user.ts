import {
  // objectType,
  // interfaceType,
  // queryType,
  // stringArg,
  // enumType,
  // intArg,
  // arg,
  // makeSchema,
  schema,
} from "nexus";

import { Node } from "./node";
import { AccountStatus } from "src/ent/user";
import User from "src/ent/user";

const AccountStatusEnum = schema.enumType({
  name: "AccountStatus",
  members: AccountStatus,
});

export const GQLUser = schema.objectType({
  name: "User",
  rootTyping: "User", // this being a string seems suspect?
  definition(t) {
    t.implements(Node); // or t.implements("Node")
    t.string("firstName");
    t.string("lastName");
    t.string("emailAddress");
    // todo figure out enum
    //    t.field("accountStatus", AccountStatusEnum);
  },
});
