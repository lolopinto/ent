// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";

import { ContactCreateType } from "src/graphql/mutations/generated/contact/contact_create_type";
import { ContactDeleteType } from "src/graphql/mutations/generated/contact/contact_delete_type";
import { ContactEditType } from "src/graphql/mutations/generated/contact/contact_edit_type";
import { EventCreateType } from "src/graphql/mutations/generated/event/event_create_type";
import { EventDeleteType } from "src/graphql/mutations/generated/event/event_delete_type";
import { EventEditType } from "src/graphql/mutations/generated/event/event_edit_type";
import { UserCreateType } from "src/graphql/mutations/generated/user/user_create_type";
import { UserDeleteType } from "src/graphql/mutations/generated/user/user_delete_type";
import { UserEditType } from "src/graphql/mutations/generated/user/user_edit_type";
import { UserAuthType } from "../user_auth_type";

export const MutationType = new GraphQLObjectType({
  name: "Mutation",
  fields: () => ({
    contactCreate: ContactCreateType,
    contactDelete: ContactDeleteType,
    contactEdit: ContactEditType,
    eventCreate: EventCreateType,
    eventDelete: EventDeleteType,
    eventEdit: EventEditType,
    userCreate: UserCreateType,
    userDelete: UserDeleteType,
    userAuth: UserAuthType,
    userEdit: UserEditType,
  }),
});
