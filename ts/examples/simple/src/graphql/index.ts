// import {
//   queryType,
//   arg,
//   idArg,
//   makeSchema,
//   fieldAuthorizePlugin,
// } from "@nexus/schema";
import path from "path";

import { schema } from "nexus";
import { GQLUser } from "./user";
import User from "src/ent/user";
import { LoggedOutViewer } from "ent/viewer";
import { GraphQLServer } from "graphql-yoga";

const Query = schema.queryType({
  definition(t) {
    t.field("user", {
      type: GQLUser,
      args: {
        name: schema.idArg(),
      },
      resolve(root, args, ctx, info) {
        console.log(args);
        return new User(new LoggedOutViewer(), "1", {});
      },
    });
  },
});

// export const s = schema.makeSchema({
//   types: [GQLUser, Query],
//   outputs: {
//     schema: path.join(__dirname, "schema.graphql"),
//     typegen: path.join(__dirname, "generated", "nexus.ts"),
//   },
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
// });

// console.log(schema);

// const server = new GraphQLServer({
//   schema,
// });

// server.start(() => `Server is running on http://localhost:4000`);
