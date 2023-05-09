/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { GraphQLUnionType } from "graphql";
import {
  ContactDateType,
  ContactEmailType,
  ContactPhoneNumberType,
} from "../../resolvers/internal";

export const ContactItemResultType = new GraphQLUnionType({
  name: "ContactItemResult",
  types: () => [ContactEmailType, ContactPhoneNumberType, ContactDateType],
});
