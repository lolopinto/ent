/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { GraphQLUnionType } from "graphql";
import {
  ContactEmailType,
  ContactPhoneNumberType,
} from "../../resolvers/internal";

export const ContactInfoType = new GraphQLUnionType({
  name: "ContactInfo",
  types: () => [ContactPhoneNumberType, ContactEmailType],
});
