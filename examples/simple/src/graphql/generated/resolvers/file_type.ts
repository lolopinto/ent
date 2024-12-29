/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { GraphQLNodeInterface, nodeIDEncoder } from "@snowtop/ent/graphql";
import { File } from "../../../ent";
import { UserType } from "../../resolvers/internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

export const FileType = new GraphQLObjectType({
  name: "File",
  fields: (): GraphQLFieldConfigMap<
    File,
    RequestContext<ExampleViewerAlias>
  > => ({
    creator: {
      type: UserType,
      resolve: (
        obj: File,
        args: {},
        context: RequestContext<ExampleViewerAlias>,
      ) => {
        return obj.loadCreator();
      },
    },
    id: {
      type: new GraphQLNonNull(GraphQLID),
      resolve: nodeIDEncoder,
    },
    name: {
      type: new GraphQLNonNull(GraphQLString),
    },
    path: {
      type: new GraphQLNonNull(GraphQLString),
    },
  }),
  interfaces: () => [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof File;
  },
});
