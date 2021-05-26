// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { AddressCreateType } from "src/graphql/mutations/generated/address/address_create_type";
import { BulkUploadContactType } from "src/graphql/mutations/generated/bulk_upload_contact_type";
import { ConfirmEmailAddressEditType } from "src/graphql/mutations/generated/user/confirm_email_address_edit_type";
import { ConfirmPhoneNumberEditType } from "src/graphql/mutations/generated/user/confirm_phone_number_edit_type";
import { ContactCreateType } from "src/graphql/mutations/generated/contact/contact_create_type";
import { ContactDeleteType } from "src/graphql/mutations/generated/contact/contact_delete_type";
import { ContactEditType } from "src/graphql/mutations/generated/contact/contact_edit_type";
import { EmailAddressEditType } from "src/graphql/mutations/generated/user/email_address_edit_type";
import { EventAddHostType } from "src/graphql/mutations/generated/event/event_add_host_type";
import { EventCreateType } from "src/graphql/mutations/generated/event/event_create_type";
import { EventDeleteType } from "src/graphql/mutations/generated/event/event_delete_type";
import { EventEditType } from "src/graphql/mutations/generated/event/event_edit_type";
import { EventRemoveHostType } from "src/graphql/mutations/generated/event/event_remove_host_type";
import { EventRsvpStatusEditType } from "src/graphql/mutations/generated/event/event_rsvp_status_edit_type";
import { HolidayCreateType } from "src/graphql/mutations/generated/holiday/holiday_create_type";
import { HoursOfOperationCreateType } from "src/graphql/mutations/generated/hours_of_operation/hours_of_operation_create_type";
import { PhoneNumberEditType } from "src/graphql/mutations/generated/user/phone_number_edit_type";
import { UserAuthType } from "src/graphql/mutations/generated/user_auth_type";
import { UserAuthJWTType } from "src/graphql/mutations/generated/user_auth_jwt_type";
import { UserCreateType } from "src/graphql/mutations/generated/user/user_create_type";
import { UserDeleteType } from "src/graphql/mutations/generated/user/user_delete_type";
import { UserEditType } from "src/graphql/mutations/generated/user/user_edit_type";

export const MutationType = new GraphQLObjectType({
  name: "Mutation",
  fields: () => ({
    addressCreate: AddressCreateType,
    bulkUploadContact: BulkUploadContactType,
    confirmEmailAddressEdit: ConfirmEmailAddressEditType,
    confirmPhoneNumberEdit: ConfirmPhoneNumberEditType,
    contactCreate: ContactCreateType,
    contactDelete: ContactDeleteType,
    contactEdit: ContactEditType,
    emailAddressEdit: EmailAddressEditType,
    eventAddHost: EventAddHostType,
    eventCreate: EventCreateType,
    eventDelete: EventDeleteType,
    eventEdit: EventEditType,
    eventRemoveHost: EventRemoveHostType,
    eventRsvpStatusEdit: EventRsvpStatusEditType,
    holidayCreate: HolidayCreateType,
    hoursOfOperationCreate: HoursOfOperationCreateType,
    phoneNumberEdit: PhoneNumberEditType,
    userAuth: UserAuthType,
    userAuthJWT: UserAuthJWTType,
    userCreate: UserCreateType,
    userDelete: UserDeleteType,
    userEdit: UserEditType,
  }),
});
