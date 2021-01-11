// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { EventActivityCreateType } from "src/graphql/mutations/generated/event_activity/event_activity_create_type";
import { EventActivityDeleteType } from "src/graphql/mutations/generated/event_activity/event_activity_delete_type";
import { EventActivityEditType } from "src/graphql/mutations/generated/event_activity/event_activity_edit_type";
import { EventCreateType } from "src/graphql/mutations/generated/event/event_create_type";
import { EventDeleteType } from "src/graphql/mutations/generated/event/event_delete_type";
import { EventEditType } from "src/graphql/mutations/generated/event/event_edit_type";
import { GuestCreateType } from "src/graphql/mutations/generated/guest/guest_create_type";
import { GuestDeleteType } from "src/graphql/mutations/generated/guest/guest_delete_type";
import { GuestEditType } from "src/graphql/mutations/generated/guest/guest_edit_type";
import { GuestGroupCreateType } from "src/graphql/mutations/generated/guest_group/guest_group_create_type";
import { GuestGroupDeleteType } from "src/graphql/mutations/generated/guest_group/guest_group_delete_type";
import { GuestGroupEditType } from "src/graphql/mutations/generated/guest_group/guest_group_edit_type";

export const MutationType = new GraphQLObjectType({
  name: "Mutation",
  fields: () => ({
    eventActivityCreate: EventActivityCreateType,
    eventActivityDelete: EventActivityDeleteType,
    eventActivityEdit: EventActivityEditType,
    eventCreate: EventCreateType,
    eventDelete: EventDeleteType,
    eventEdit: EventEditType,
    guestCreate: GuestCreateType,
    guestDelete: GuestDeleteType,
    guestEdit: GuestEditType,
    guestGroupCreate: GuestGroupCreateType,
    guestGroupDelete: GuestGroupDeleteType,
    guestGroupEdit: GuestGroupEditType,
  }),
});
