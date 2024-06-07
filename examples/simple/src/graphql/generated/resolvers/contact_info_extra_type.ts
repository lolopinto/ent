/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLBoolean,
  GraphQLFieldConfigMap,
  GraphQLNonNull,
  GraphQLObjectType,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { ContactInfoExtra } from "../../../ent/generated/types";
import { ContactInfoSourceType } from "../../resolvers/internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

export const ContactInfoExtraType = new GraphQLObjectType({
  name: "ContactInfoExtra",
  fields: (): GraphQLFieldConfigMap<
    ContactInfoExtra,
    RequestContext<ExampleViewerAlias>
  > => ({
    default: {
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    source: {
      type: new GraphQLNonNull(ContactInfoSourceType),
    },
  }),
});
