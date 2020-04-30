import {
  objectType,
  interfaceType,
  queryType,
  stringArg,
  enumType,
  intArg,
  arg,
  makeSchema,
} from "@nexus/schema";

import { Node } from "./node";
import { AccountStatus } from "src/ent/user";

const AccountStatusEnum = enumType({
  name: "AccountStatus",
  members: AccountStatus,
});

export const GQLUser = objectType({
  name: "User",
  definition(t) {
    t.implements(Node); // or t.implements("Node")
    t.string("firstName");
    t.string("lastName");
    t.string("emailAddress");
    // todo figure out enum
    //    t.field("accountStatus", AccountStatusEnum);
  },
});
