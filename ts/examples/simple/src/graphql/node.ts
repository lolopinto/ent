import {
  schema,
  // objectType,
  // interfaceType,
  // queryType,
  // stringArg,
  // enumType,
  // intArg,
  // arg,
  // makeSchema,
} from "nexus";

import { ID } from "ent/ent";
export const Node = schema.interfaceType({
  name: "Node",
  rootTyping: "ID",
  definition(t) {
    t.id("id", { description: "Unique identifier for the resource" });
    t.resolveType(() => null);
  },
});
