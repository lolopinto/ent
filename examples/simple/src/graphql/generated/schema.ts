/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { GraphQLSchema } from "graphql";
import {
  AddressCreateInputType,
  AddressCreatePayloadType,
} from "../mutations/generated/address/address_create_type";
import {
  CommentCreateInputType,
  CommentCreatePayloadType,
} from "../mutations/generated/comment/comment_create_type";
import {
  ContactCreateInputType,
  ContactCreatePayloadType,
  EmailContactCreateInput,
  PhoneNumberContactCreateInput,
} from "../mutations/generated/contact/contact_create_type";
import {
  ContactDeleteInputType,
  ContactDeletePayloadType,
} from "../mutations/generated/contact/contact_delete_type";
import {
  ContactEditInputType,
  ContactEditPayloadType,
} from "../mutations/generated/contact/contact_edit_type";
import {
  ContactEmailCreateInputType,
  ContactEmailCreatePayloadType,
} from "../mutations/generated/contact_email/contact_email_create_type";
import {
  ContactEmailDeleteInputType,
  ContactEmailDeletePayloadType,
} from "../mutations/generated/contact_email/contact_email_delete_type";
import {
  ContactEmailEditInputType,
  ContactEmailEditPayloadType,
} from "../mutations/generated/contact_email/contact_email_edit_type";
import {
  ContactPhoneNumberCreateInputType,
  ContactPhoneNumberCreatePayloadType,
} from "../mutations/generated/contact_phone_number/contact_phone_number_create_type";
import {
  ContactPhoneNumberDeleteInputType,
  ContactPhoneNumberDeletePayloadType,
} from "../mutations/generated/contact_phone_number/contact_phone_number_delete_type";
import {
  ContactPhoneNumberEditInputType,
  ContactPhoneNumberEditPayloadType,
} from "../mutations/generated/contact_phone_number/contact_phone_number_edit_type";
import {
  EventAddHostInputType,
  EventAddHostPayloadType,
} from "../mutations/generated/event/event_add_host_type";
import {
  EventCreateInputType,
  EventCreatePayloadType,
} from "../mutations/generated/event/event_create_type";
import {
  EventDeleteInputType,
  EventDeletePayloadType,
} from "../mutations/generated/event/event_delete_type";
import {
  EventEditInputType,
  EventEditPayloadType,
} from "../mutations/generated/event/event_edit_type";
import {
  EventRemoveHostInputType,
  EventRemoveHostPayloadType,
} from "../mutations/generated/event/event_remove_host_type";
import {
  EventRsvpStatusEditInputType,
  EventRsvpStatusEditPayloadType,
  EventRsvpStatusInputType,
} from "../mutations/generated/event/event_rsvp_status_edit_type";
import {
  HolidayCreateInputType,
  HolidayCreatePayloadType,
} from "../mutations/generated/holiday/holiday_create_type";
import {
  HoursOfOperationCreateInputType,
  HoursOfOperationCreatePayloadType,
} from "../mutations/generated/hours_of_operation/hours_of_operation_create_type";
import { MutationType } from "../mutations/generated/mutation_type";
import {
  ConfirmEmailAddressEditInputType,
  ConfirmEmailAddressEditPayloadType,
} from "../mutations/generated/user/confirm_email_address_edit_type";
import {
  ConfirmPhoneNumberEditInputType,
  ConfirmPhoneNumberEditPayloadType,
} from "../mutations/generated/user/confirm_phone_number_edit_type";
import {
  EmailAddressEditInputType,
  EmailAddressEditPayloadType,
} from "../mutations/generated/user/email_address_edit_type";
import {
  PhoneNumberEditInputType,
  PhoneNumberEditPayloadType,
} from "../mutations/generated/user/phone_number_edit_type";
import {
  UserCreateInputType,
  UserCreatePayloadType,
} from "../mutations/generated/user/user_create_type";
import {
  UserDelete2InputType,
  UserDelete2PayloadType,
} from "../mutations/generated/user/user_delete_2_type";
import {
  UserDeleteInputType,
  UserDeletePayloadType,
} from "../mutations/generated/user/user_delete_type";
import {
  UserEditInputType,
  UserEditPayloadType,
} from "../mutations/generated/user/user_edit_type";
import {
  UserAuthJWTInputType,
  UserAuthJWTPayloadType,
} from "../mutations/generated/user_auth_jwt_type";
import {
  UserAuthInputType,
  UserAuthPayloadType,
} from "../mutations/generated/user_auth_type";
import {
  AddressToHostedEventsConnectionType,
  AddressType,
  CommentToPostConnectionType,
  CommentType,
  ContactEmailType,
  ContactPhoneNumberType,
  ContactToCommentsConnectionType,
  ContactToLikersConnectionType,
  ContactType,
  DayOfWeekAltType,
  DayOfWeekType,
  DaysOffType,
  EventRsvpStatusType,
  EventToAttendingConnectionType,
  EventToDeclinedConnectionType,
  EventToHostsConnectionType,
  EventToInvitedConnectionType,
  EventToMaybeConnectionType,
  EventType,
  GQLViewerType,
  HolidayType,
  HoursOfOperationType,
  PreferredShiftType,
  UserToCommentsConnectionType,
  UserToContactsConnectionType,
  UserToCreatedEventsConnectionType,
  UserToDeclinedEventsConnectionType,
  UserToEventsAttendingConnectionType,
  UserToFriendsConnectionType,
  UserToHostedEventsConnectionType,
  UserToInvitedEventsConnectionType,
  UserToLikersConnectionType,
  UserToLikesConnectionType,
  UserToMaybeEventsConnectionType,
  UserType,
} from "../resolvers";
import { QueryType } from "../resolvers/generated/query_type";

export default new GraphQLSchema({
  query: QueryType,
  mutation: MutationType,
  types: [
    DayOfWeekAltType,
    DayOfWeekType,
    DaysOffType,
    EventRsvpStatusType,
    PreferredShiftType,
    AddressType,
    CommentType,
    ContactEmailType,
    ContactPhoneNumberType,
    ContactType,
    EventType,
    HolidayType,
    HoursOfOperationType,
    UserType,
    AddressToHostedEventsConnectionType(),
    CommentToPostConnectionType(),
    ContactToCommentsConnectionType(),
    ContactToLikersConnectionType(),
    EventToAttendingConnectionType(),
    EventToDeclinedConnectionType(),
    EventToHostsConnectionType(),
    EventToInvitedConnectionType(),
    EventToMaybeConnectionType(),
    UserToCommentsConnectionType(),
    UserToContactsConnectionType(),
    UserToCreatedEventsConnectionType(),
    UserToDeclinedEventsConnectionType(),
    UserToEventsAttendingConnectionType(),
    UserToFriendsConnectionType(),
    UserToHostedEventsConnectionType(),
    UserToInvitedEventsConnectionType(),
    UserToLikersConnectionType(),
    UserToLikesConnectionType(),
    UserToMaybeEventsConnectionType(),
    GQLViewerType,
    GQLViewerType,
    UserAuthInputType,
    UserAuthJWTInputType,
    UserAuthJWTPayloadType,
    UserAuthPayloadType,
    AddressCreateInputType,
    AddressCreatePayloadType,
    CommentCreateInputType,
    CommentCreatePayloadType,
    ConfirmEmailAddressEditInputType,
    ConfirmEmailAddressEditPayloadType,
    ConfirmPhoneNumberEditInputType,
    ConfirmPhoneNumberEditPayloadType,
    ContactCreateInputType,
    ContactCreatePayloadType,
    ContactDeleteInputType,
    ContactDeletePayloadType,
    ContactEditInputType,
    ContactEditPayloadType,
    ContactEmailCreateInputType,
    ContactEmailCreatePayloadType,
    ContactEmailDeleteInputType,
    ContactEmailDeletePayloadType,
    ContactEmailEditInputType,
    ContactEmailEditPayloadType,
    ContactPhoneNumberCreateInputType,
    ContactPhoneNumberCreatePayloadType,
    ContactPhoneNumberDeleteInputType,
    ContactPhoneNumberDeletePayloadType,
    ContactPhoneNumberEditInputType,
    ContactPhoneNumberEditPayloadType,
    EmailAddressEditInputType,
    EmailAddressEditPayloadType,
    EmailContactCreateInput,
    EventAddHostInputType,
    EventAddHostPayloadType,
    EventCreateInputType,
    EventCreatePayloadType,
    EventDeleteInputType,
    EventDeletePayloadType,
    EventEditInputType,
    EventEditPayloadType,
    EventRemoveHostInputType,
    EventRemoveHostPayloadType,
    EventRsvpStatusEditInputType,
    EventRsvpStatusEditPayloadType,
    EventRsvpStatusInputType,
    HolidayCreateInputType,
    HolidayCreatePayloadType,
    HoursOfOperationCreateInputType,
    HoursOfOperationCreatePayloadType,
    PhoneNumberContactCreateInput,
    PhoneNumberEditInputType,
    PhoneNumberEditPayloadType,
    UserCreateInputType,
    UserCreatePayloadType,
    UserDelete2InputType,
    UserDelete2PayloadType,
    UserDeleteInputType,
    UserDeletePayloadType,
    UserEditInputType,
    UserEditPayloadType,
  ],
});
