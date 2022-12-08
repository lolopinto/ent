/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { GraphQLSchema } from "graphql";
import {
  AddressCreateInputType,
  AddressCreatePayloadType,
} from "./mutations/address/address_create_type";
import {
  CommentCreateInputType,
  CommentCreatePayloadType,
} from "./mutations/comment/comment_create_type";
import {
  ContactCreateInputType,
  ContactCreatePayloadType,
  EmailContactCreateInput,
  PhoneNumberContactCreateInput,
} from "./mutations/contact/contact_create_type";
import {
  ContactDeleteInputType,
  ContactDeletePayloadType,
} from "./mutations/contact/contact_delete_type";
import {
  ContactEditInputType,
  ContactEditPayloadType,
} from "./mutations/contact/contact_edit_type";
import {
  ContactEmailCreateInputType,
  ContactEmailCreatePayloadType,
} from "./mutations/contact_email/contact_email_create_type";
import {
  ContactEmailDeleteInputType,
  ContactEmailDeletePayloadType,
} from "./mutations/contact_email/contact_email_delete_type";
import {
  ContactEmailEditInputType,
  ContactEmailEditPayloadType,
} from "./mutations/contact_email/contact_email_edit_type";
import {
  ContactPhoneNumberCreateInputType,
  ContactPhoneNumberCreatePayloadType,
} from "./mutations/contact_phone_number/contact_phone_number_create_type";
import {
  ContactPhoneNumberDeleteInputType,
  ContactPhoneNumberDeletePayloadType,
} from "./mutations/contact_phone_number/contact_phone_number_delete_type";
import {
  ContactPhoneNumberEditInputType,
  ContactPhoneNumberEditPayloadType,
} from "./mutations/contact_phone_number/contact_phone_number_edit_type";
import {
  EventAddHostInputType,
  EventAddHostPayloadType,
} from "./mutations/event/event_add_host_type";
import {
  EventCreateInputType,
  EventCreatePayloadType,
} from "./mutations/event/event_create_type";
import {
  EventDeleteInputType,
  EventDeletePayloadType,
} from "./mutations/event/event_delete_type";
import {
  EventEditInputType,
  EventEditPayloadType,
} from "./mutations/event/event_edit_type";
import {
  EventRemoveHostInputType,
  EventRemoveHostPayloadType,
} from "./mutations/event/event_remove_host_type";
import {
  ClearEventRsvpStatusInputType,
  ClearEventRsvpStatusPayloadType,
} from "./mutations/event/event_rsvp_status_clear_type";
import {
  EventRsvpStatusEditInputType,
  EventRsvpStatusEditPayloadType,
  EventRsvpStatusInputType,
} from "./mutations/event/event_rsvp_status_edit_type";
import {
  HolidayCreateInputType,
  HolidayCreatePayloadType,
} from "./mutations/holiday/holiday_create_type";
import {
  HoursOfOperationCreateInputType,
  HoursOfOperationCreatePayloadType,
} from "./mutations/hours_of_operation/hours_of_operation_create_type";
import { ContactInfoInputType } from "./mutations/input/contact_info_input_type";
import { UserNestedObjectListInputType } from "./mutations/input/user_nested_object_list_input_type";
import { UserPrefsDiffInputType } from "./mutations/input/user_prefs_diff_input_type";
import { UserPrefsStruct2InputType } from "./mutations/input/user_prefs_struct_2_input_type";
import { UserPrefsStructInputType } from "./mutations/input/user_prefs_struct_input_type";
import { UserSuperNestedObjectInputType } from "./mutations/input/user_super_nested_object_input_type";
import { MutationType } from "./mutations/mutation_type";
import {
  ConfirmEditEmailAddressInputType,
  ConfirmEditEmailAddressPayloadType,
} from "./mutations/user/confirm_email_address_edit_type";
import {
  ConfirmEditPhoneNumberInputType,
  ConfirmEditPhoneNumberPayloadType,
} from "./mutations/user/confirm_phone_number_edit_type";
import {
  EditEmailAddressInputType,
  EditEmailAddressPayloadType,
} from "./mutations/user/email_address_edit_type";
import {
  EditPhoneNumberInputType,
  EditPhoneNumberPayloadType,
} from "./mutations/user/phone_number_edit_type";
import {
  UserCreateInputType,
  UserCreatePayloadType,
} from "./mutations/user/user_create_type";
import {
  DeleteUserInput2PayloadType,
  DeleteUserInput2Type,
} from "./mutations/user/user_delete_2_type";
import {
  UserDeleteInputType,
  UserDeletePayloadType,
} from "./mutations/user/user_delete_type";
import {
  UserEditInputType,
  UserEditPayloadType,
} from "./mutations/user/user_edit_type";
import {
  UserAuthJWTInputType,
  UserAuthJWTPayloadType,
} from "./mutations/user_auth_jwt_type";
import {
  UserAuthInputType,
  UserAuthPayloadType,
} from "./mutations/user_auth_type";
import { QueryType } from "./resolvers/query_type";
import {
  AddressToHostedEventsConnectionType,
  AddressType,
  CatBreedType,
  CommentToPostConnectionType,
  CommentType,
  ContactEmailLabelType,
  ContactEmailType,
  ContactInfoSourceType,
  ContactInfoType,
  ContactPhoneNumberLabelType,
  ContactPhoneNumberType,
  ContactToCommentsConnectionType,
  ContactToLikersConnectionType,
  ContactType,
  DayOfWeekAltType,
  DayOfWeekType,
  DogBreedGroupType,
  DogBreedType,
  EnumUsedInListType,
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
  IntEnumUsedInListType,
  NestedObjNestedNestedEnumType,
  NotifType2Type,
  NotifTypeType,
  ObjNestedEnumType,
  RabbitBreedType,
  SuperNestedObjectEnumType,
  UserAccountStatusType,
  UserDaysOffType,
  UserIntEnumType,
  UserNestedObjectListType,
  UserPreferredShiftType,
  UserPrefsDiffType,
  UserPrefsStruct2Type,
  UserPrefsStructType,
  UserSuperNestedObjectType,
  UserToCommentsAuthoredConnectionType,
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

export default new GraphQLSchema({
  query: QueryType,
  mutation: MutationType,
  types: [
    CatBreedType,
    ContactEmailLabelType,
    ContactInfoSourceType,
    ContactPhoneNumberLabelType,
    DayOfWeekAltType,
    DayOfWeekType,
    DogBreedGroupType,
    DogBreedType,
    EnumUsedInListType,
    EventRsvpStatusType,
    IntEnumUsedInListType,
    NestedObjNestedNestedEnumType,
    NotifType2Type,
    NotifTypeType,
    ObjNestedEnumType,
    RabbitBreedType,
    SuperNestedObjectEnumType,
    UserAccountStatusType,
    UserDaysOffType,
    UserIntEnumType,
    UserPreferredShiftType,
    AddressType,
    CommentType,
    ContactEmailType,
    ContactInfoType,
    ContactPhoneNumberType,
    ContactType,
    EventType,
    HolidayType,
    HoursOfOperationType,
    UserNestedObjectListType,
    UserPrefsDiffType,
    UserPrefsStruct2Type,
    UserPrefsStructType,
    UserSuperNestedObjectType,
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
    UserToCommentsAuthoredConnectionType(),
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
    UserAuthInputType,
    UserAuthJWTInputType,
    UserAuthJWTPayloadType,
    UserAuthPayloadType,
    AddressCreateInputType,
    AddressCreatePayloadType,
    ClearEventRsvpStatusInputType,
    ClearEventRsvpStatusPayloadType,
    CommentCreateInputType,
    CommentCreatePayloadType,
    ConfirmEditEmailAddressInputType,
    ConfirmEditEmailAddressPayloadType,
    ConfirmEditPhoneNumberInputType,
    ConfirmEditPhoneNumberPayloadType,
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
    ContactInfoInputType,
    ContactPhoneNumberCreateInputType,
    ContactPhoneNumberCreatePayloadType,
    ContactPhoneNumberDeleteInputType,
    ContactPhoneNumberDeletePayloadType,
    ContactPhoneNumberEditInputType,
    ContactPhoneNumberEditPayloadType,
    DeleteUserInput2PayloadType,
    DeleteUserInput2Type,
    EditEmailAddressInputType,
    EditEmailAddressPayloadType,
    EditPhoneNumberInputType,
    EditPhoneNumberPayloadType,
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
    UserCreateInputType,
    UserCreatePayloadType,
    UserDeleteInputType,
    UserDeletePayloadType,
    UserEditInputType,
    UserEditPayloadType,
    UserNestedObjectListInputType,
    UserPrefsDiffInputType,
    UserPrefsStruct2InputType,
    UserPrefsStructInputType,
    UserSuperNestedObjectInputType,
  ],
});
