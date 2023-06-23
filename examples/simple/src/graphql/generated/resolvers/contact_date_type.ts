/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLFieldConfigMap,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { GraphQLTime } from "@snowtop/ent/graphql";
import { ContactLabelType, ContactType } from "../../resolvers/internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";
import { ContactDate } from "../../../ent/contact";

export const ContactDateType = new GraphQLObjectType({
  name: "ContactDate",
  fields: (): GraphQLFieldConfigMap<
    ContactDate,
    RequestContext<ExampleViewerAlias>
  > => ({
    label: {
      type: new GraphQLNonNull(ContactLabelType),
    },
    contact: {
      type: ContactType,
    },
    date: {
      type: new GraphQLNonNull(GraphQLTime),
    },
    description: {
      type: new GraphQLNonNull(GraphQLString),
    },
  }),
  isTypeOf(obj) {
    return obj instanceof ContactDate;
  },
});
