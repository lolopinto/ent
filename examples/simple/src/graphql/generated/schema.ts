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
  CommentEditInputType,
  CommentEditPayloadType,
} from "./mutations/comment/comment_edit_type";
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
  EmailContactEditInput,
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
} from "./mutations/event/event_rsvp_status_edit_type";
import {
  FileCreateInputType,
  FileCreatePayloadType,
} from "./mutations/file/file_create_type";
import {
  FileDeleteInputType,
  FileDeletePayloadType,
} from "./mutations/file/file_delete_type";
import {
  FileEditInputType,
  FileEditPayloadType,
} from "./mutations/file/file_edit_type";
import {
  HolidayCreateInputType,
  HolidayCreatePayloadType,
} from "./mutations/holiday/holiday_create_type";
import {
  CustomEditHolidayInputType,
  CustomEditHolidayPayloadType,
} from "./mutations/holiday/holiday_custom_edit_type";
import {
  HoursOfOperationCreateInputType,
  HoursOfOperationCreatePayloadType,
} from "./mutations/hours_of_operation/hours_of_operation_create_type";
import { AttachmentInputType } from "./mutations/input/attachment_input_type";
import { CommentArgInputType } from "./mutations/input/comment_arg_input_type";
import { ContactArgInputType } from "./mutations/input/contact_arg_input_type";
import { ContactEmailArgInputType } from "./mutations/input/contact_email_arg_input_type";
import { ContactInfoExtraInputType } from "./mutations/input/contact_info_extra_input_type";
import { ContactPhoneNumberArgInputType } from "./mutations/input/contact_phone_number_arg_input_type";
import { EventArgInputType } from "./mutations/input/event_arg_input_type";
import { FileArgInputType } from "./mutations/input/file_arg_input_type";
import { HolidayArgInputType } from "./mutations/input/holiday_arg_input_type";
import { HoursOfOperationArgInputType } from "./mutations/input/hours_of_operation_arg_input_type";
import { UserArgInputType } from "./mutations/input/user_arg_input_type";
import { UserNestedObjectListInputType } from "./mutations/input/user_nested_object_list_input_type";
import { UserPrefsDiffInputType } from "./mutations/input/user_prefs_diff_input_type";
import { UserPrefsStructInputType } from "./mutations/input/user_prefs_struct_input_type";
import { UserStatisticsArgInputType } from "./mutations/input/user_statistics_arg_input_type";
import { UserSuperNestedObjectInputType } from "./mutations/input/user_super_nested_object_input_type";
import { EventRsvpStatusInputType } from "./mutations/input_enums_type";
import { MutationType } from "./mutations/mutation_type";
import { PhoneAvailableArgType } from "./mutations/phone_available_type";
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
} from "./mutations/user/user_delete2_type";
import {
  UserDeleteInputType,
  UserDeletePayloadType,
} from "./mutations/user/user_delete_type";
import {
  UserEditInputType,
  UserEditPayloadType,
} from "./mutations/user/user_edit_type";
import { UserAuthJWTLoginType } from "./mutations/user_auth_jwt2_type";
import {
  UserAuthJWTInputType,
  UserAuthJWTPayloadType,
} from "./mutations/user_auth_jwt_type";
import {
  UserAuthInputType,
  UserAuthPayloadType,
} from "./mutations/user_auth_type";
import {
  UserStatisticsCreateInputType,
  UserStatisticsCreatePayloadType,
} from "./mutations/user_statistics/user_statistics_create_type";
import {
  UserStatisticsDeleteInputType,
  UserStatisticsDeletePayloadType,
} from "./mutations/user_statistics/user_statistics_delete_type";
import {
  UserStatisticsEditInputType,
  UserStatisticsEditPayloadType,
} from "./mutations/user_statistics/user_statistics_edit_type";
import { QueryType } from "./resolvers/query_type";
import {
  AddressToHostedEventsConnectionType,
  AddressType,
  AttachmentType,
  AuthorToCommentsConnectionType,
  CatBreedType,
  CityType,
  CommentArticleToCommentsConnectionType,
  CommentSortColumnType,
  CommentToPostConnectionType,
  CommentType,
  ContactCommentsFromAttachmentConnectionType,
  ContactDateType,
  ContactEmailCanViewerDoType,
  ContactEmailSortColumnType,
  ContactEmailToCommentsConnectionType,
  ContactEmailToLikersConnectionType,
  ContactEmailType,
  ContactInfoExtraType,
  ContactInfoSourceType,
  ContactInfoType,
  ContactItemFilterType,
  ContactItemResultType,
  ContactItemType,
  ContactLabelType,
  ContactPhoneNumberSortColumnType,
  ContactPhoneNumberToCommentsConnectionType,
  ContactPhoneNumberToLikersConnectionType,
  ContactPhoneNumberType,
  ContactSortColumnType,
  ContactToCommentsConnectionType,
  ContactToFilterContactEmailsConnectionType,
  ContactToLikersConnectionType,
  ContactType,
  CreatorToEventsConnectionType,
  DayOfWeekAltType,
  DayOfWeekType,
  DogBreedGroupType,
  DogBreedType,
  EmailInfoType,
  EventCanViewerSeeType,
  EventRsvpStatusType,
  EventSortColumnType,
  EventToAttendingConnectionType,
  EventToDeclinedConnectionType,
  EventToHostsConnectionType,
  EventToInvitedConnectionType,
  EventToMaybeConnectionType,
  EventType,
  FeedbackType,
  FileSortColumnType,
  FileType,
  GlobalCanViewerDoType,
  HolidaySortColumnType,
  HolidayType,
  HoursOfOperationSortColumnType,
  HoursOfOperationType,
  IntEnumUsedInListType,
  NotifTypeType,
  RabbitBreedType,
  ResponseTypeType,
  RootToCommentConnectionType,
  RootToContactConnectionType,
  RootToContactEmailConnectionType,
  RootToContactPhoneNumberConnectionType,
  RootToEventConnectionType,
  RootToFileConnectionType,
  RootToHolidayConnectionType,
  RootToHoursOfOperationConnectionType,
  RootToUserConnectionType,
  RootToUserStatisticsConnectionType,
  UserAccountStatusType,
  UserArticleToCommentsConnectionType,
  UserCanViewerDoType,
  UserCanViewerEditType,
  UserCanViewerSeeType,
  UserCommentsFromAttachmentConnectionType,
  UserDaysOffType,
  UserIntEnumType,
  UserNestedObjectListType,
  UserPreferredShiftType,
  UserPrefsDiffType,
  UserPrefsStructType,
  UserSortColumnType,
  UserStatisticsSortColumnType,
  UserStatisticsType,
  UserSuperNestedObjectType,
  UserToCommentsAuthoredConnectionType,
  UserToCommentsConnectionType,
  UserToContactEmailsConnectionType,
  UserToContactPhoneNumbersConnectionType,
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
  ViewerType,
  WithDayOfWeekType,
} from "../resolvers";
import { SubscriptionType } from "../resolvers/subscription_type";

export default new GraphQLSchema({
  query: QueryType,
  mutation: MutationType,
  subscription: SubscriptionType,
  types: [
    CatBreedType,
    CommentSortColumnType,
    ContactEmailSortColumnType,
    ContactInfoSourceType,
    ContactLabelType,
    ContactPhoneNumberSortColumnType,
    ContactSortColumnType,
    DayOfWeekAltType,
    DayOfWeekType,
    DogBreedGroupType,
    DogBreedType,
    EventRsvpStatusType,
    EventSortColumnType,
    FileSortColumnType,
    HolidaySortColumnType,
    HoursOfOperationSortColumnType,
    IntEnumUsedInListType,
    NotifTypeType,
    RabbitBreedType,
    ResponseTypeType,
    UserAccountStatusType,
    UserDaysOffType,
    UserIntEnumType,
    UserPreferredShiftType,
    UserSortColumnType,
    UserStatisticsSortColumnType,
    AddressType,
    AttachmentType,
    CityType,
    CommentType,
    ContactDateType,
    ContactEmailCanViewerDoType,
    ContactEmailType,
    ContactInfoExtraType,
    ContactInfoType,
    ContactItemFilterType,
    ContactItemResultType,
    ContactItemType,
    ContactPhoneNumberType,
    ContactType,
    EmailInfoType,
    EventCanViewerSeeType,
    EventType,
    FeedbackType,
    FileType,
    GlobalCanViewerDoType,
    HolidayType,
    HoursOfOperationType,
    UserCanViewerDoType,
    UserCanViewerEditType,
    UserCanViewerSeeType,
    UserNestedObjectListType,
    UserPrefsDiffType,
    UserPrefsStructType,
    UserStatisticsType,
    UserSuperNestedObjectType,
    UserType,
    WithDayOfWeekType,
    AddressToHostedEventsConnectionType(),
    AuthorToCommentsConnectionType(),
    CommentArticleToCommentsConnectionType(),
    CommentToPostConnectionType(),
    ContactCommentsFromAttachmentConnectionType(),
    ContactEmailToCommentsConnectionType(),
    ContactEmailToLikersConnectionType(),
    ContactPhoneNumberToCommentsConnectionType(),
    ContactPhoneNumberToLikersConnectionType(),
    ContactToCommentsConnectionType(),
    ContactToFilterContactEmailsConnectionType(),
    ContactToLikersConnectionType(),
    CreatorToEventsConnectionType(),
    EventToAttendingConnectionType(),
    EventToDeclinedConnectionType(),
    EventToHostsConnectionType(),
    EventToInvitedConnectionType(),
    EventToMaybeConnectionType(),
    RootToCommentConnectionType(),
    RootToContactConnectionType(),
    RootToContactEmailConnectionType(),
    RootToContactPhoneNumberConnectionType(),
    RootToEventConnectionType(),
    RootToFileConnectionType(),
    RootToHolidayConnectionType(),
    RootToHoursOfOperationConnectionType(),
    RootToUserConnectionType(),
    RootToUserStatisticsConnectionType(),
    UserArticleToCommentsConnectionType(),
    UserCommentsFromAttachmentConnectionType(),
    UserToCommentsAuthoredConnectionType(),
    UserToCommentsConnectionType(),
    UserToContactEmailsConnectionType(),
    UserToContactPhoneNumbersConnectionType(),
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
    ViewerType,
    PhoneAvailableArgType,
    UserAuthInputType,
    UserAuthJWTInputType,
    UserAuthJWTLoginType,
    UserAuthJWTPayloadType,
    UserAuthPayloadType,
    AddressCreateInputType,
    AddressCreatePayloadType,
    AttachmentInputType,
    ClearEventRsvpStatusInputType,
    ClearEventRsvpStatusPayloadType,
    CommentArgInputType,
    CommentCreateInputType,
    CommentCreatePayloadType,
    CommentEditInputType,
    CommentEditPayloadType,
    ConfirmEditEmailAddressInputType,
    ConfirmEditEmailAddressPayloadType,
    ConfirmEditPhoneNumberInputType,
    ConfirmEditPhoneNumberPayloadType,
    ContactArgInputType,
    ContactCreateInputType,
    ContactCreatePayloadType,
    ContactDeleteInputType,
    ContactDeletePayloadType,
    ContactEditInputType,
    ContactEditPayloadType,
    ContactEmailArgInputType,
    ContactEmailCreateInputType,
    ContactEmailCreatePayloadType,
    ContactEmailDeleteInputType,
    ContactEmailDeletePayloadType,
    ContactEmailEditInputType,
    ContactEmailEditPayloadType,
    ContactInfoExtraInputType,
    ContactPhoneNumberArgInputType,
    ContactPhoneNumberCreateInputType,
    ContactPhoneNumberCreatePayloadType,
    ContactPhoneNumberDeleteInputType,
    ContactPhoneNumberDeletePayloadType,
    ContactPhoneNumberEditInputType,
    ContactPhoneNumberEditPayloadType,
    CustomEditHolidayInputType,
    CustomEditHolidayPayloadType,
    DeleteUserInput2PayloadType,
    DeleteUserInput2Type,
    EditEmailAddressInputType,
    EditEmailAddressPayloadType,
    EditPhoneNumberInputType,
    EditPhoneNumberPayloadType,
    EmailContactCreateInput,
    EmailContactEditInput,
    EventAddHostInputType,
    EventAddHostPayloadType,
    EventArgInputType,
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
    FileArgInputType,
    FileCreateInputType,
    FileCreatePayloadType,
    FileDeleteInputType,
    FileDeletePayloadType,
    FileEditInputType,
    FileEditPayloadType,
    HolidayArgInputType,
    HolidayCreateInputType,
    HolidayCreatePayloadType,
    HoursOfOperationArgInputType,
    HoursOfOperationCreateInputType,
    HoursOfOperationCreatePayloadType,
    PhoneNumberContactCreateInput,
    UserArgInputType,
    UserCreateInputType,
    UserCreatePayloadType,
    UserDeleteInputType,
    UserDeletePayloadType,
    UserEditInputType,
    UserEditPayloadType,
    UserNestedObjectListInputType,
    UserPrefsDiffInputType,
    UserPrefsStructInputType,
    UserStatisticsArgInputType,
    UserStatisticsCreateInputType,
    UserStatisticsCreatePayloadType,
    UserStatisticsDeleteInputType,
    UserStatisticsDeletePayloadType,
    UserStatisticsEditInputType,
    UserStatisticsEditPayloadType,
    UserSuperNestedObjectInputType,
  ],
});
