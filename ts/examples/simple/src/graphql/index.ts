import {
  queryType,
  arg,
  idArg,
  makeSchema,
  fieldAuthorizePlugin,
} from "@nexus/schema";
import path from "path";

import { GQLUser } from "./user";

const Query = queryType({
  definition(t) {
    t.field("user", {
      type: GQLUser,
      args: {
        name: idArg(),
        status: arg({ type: "ID" }),
      },
    });
  },
});

export const schema = makeSchema({
  types: [GQLUser, Query],
  outputs: {
    schema: path.join(__dirname, "schema.graphql"),
    typegen: path.join(__dirname, "generated", "nexus.ts"),
  },
  //  plugins: [fieldAuthorizePlugin()],
  // typegenAutoConfig: {
  //   contextType: "ctx.Context",
  //   s
  // sources: [
  //   {
  //     alias: "ctx",
  //     source: path.join(__dirname, "data-sources", "Context.ts"),
  //   },
  //   {
  //     alias: "db",
  //     source: path.join(__dirname, "generated", "ghost-db-types.ts"),
  //     typeMatch: (type) => new RegExp(`(?:interface)\\s+(${type.name}s)\\W`),
  //   },
  // ],
  //   backingTypeMap: {
  //     Date: "Date",
  //   },
  // },
  // TODO ...
  //  prettierConfig: path.join(__dirname, "../../../.prettierrc"),
});
