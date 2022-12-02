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
import { ContactPhoneNumber } from "../../../ent";
import {
  ContactInfoType,
  ContactPhoneNumberLabelType,
  ContactType,
} from "../../resolvers/internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

export const ContactPhoneNumberType = new GraphQLObjectType({
  name: "ContactPhoneNumber",
  fields: (): GraphQLFieldConfigMap<
    ContactPhoneNumber,
    RequestContext<ExampleViewerAlias>
  > => ({
    contact: {
      type: ContactType,
      resolve: (
        contactPhoneNumber: ContactPhoneNumber,
        args: {},
        context: RequestContext<ExampleViewerAlias>,
      ) => {
        return contactPhoneNumber.loadContact();
      },
    },
    id: {
      type: new GraphQLNonNull(GraphQLID),
      resolve: nodeIDEncoder,
    },
    extra: {
      type: ContactInfoType,
    },
    phoneNumber: {
      type: new GraphQLNonNull(GraphQLString),
    },
    label: {
      type: new GraphQLNonNull(ContactPhoneNumberLabelType),
    },
  }),
  interfaces: [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof ContactPhoneNumber;
  },
});
