/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { GraphQLUnionType } from "graphql";
import {
  ContactEmailType,
  ContactPhoneNumberType,
  ContactType,
  UserType,
} from "../../resolvers/internal";

export const FeedbackType = new GraphQLUnionType({
  name: "Feedback",
  types: () => [
    ContactType,
    ContactEmailType,
    ContactPhoneNumberType,
    UserType,
  ],
});
