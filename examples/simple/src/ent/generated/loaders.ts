/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { ID, ObjectLoaderFactory } from "@snowtop/ent";
import {
  ContactInfo,
  ContactLabel,
  DayOfWeek,
  DayOfWeekAlt,
  UserAccountStatus,
  UserDaysOff,
  UserIntEnum,
  UserNestedObjectList,
  UserPreferredShift,
  UserPrefsDiff,
  UserPrefsStruct,
  UserSuperNestedObject,
} from "./types";
import { NodeType } from "./types";

export interface AddressDBData {
  id: ID;
  created_at: Date;
  updated_at: Date;
  street_name: string;
  city: string;
  state: string;
  zip: string;
  apartment: string | null;
  country: string;
}

const addressTable = "addresses";
const addressFields = [
  "id",
  "created_at",
  "updated_at",
  "street_name",
  "city",
  "state",
  "zip",
  "apartment",
  "country",
];

export const addressLoader = new ObjectLoaderFactory<AddressDBData>({
  tableName: addressTable,
  fields: addressFields,
  key: "id",
});

export const addressLoaderInfo = {
  tableName: addressTable,
  fields: addressFields,
  nodeType: NodeType.Address,
  loaderFactory: addressLoader,
  fieldInfo: {
    ID: {
      dbCol: "id",
      inputKey: "id",
    },
    createdAt: {
      dbCol: "created_at",
      inputKey: "createdAt",
    },
    updatedAt: {
      dbCol: "updated_at",
      inputKey: "updatedAt",
    },
    street_name: {
      dbCol: "street_name",
      inputKey: "streetName",
    },
    city: {
      dbCol: "city",
      inputKey: "city",
    },
    state: {
      dbCol: "state",
      inputKey: "state",
    },
    zip: {
      dbCol: "zip",
      inputKey: "zip",
    },
    apartment: {
      dbCol: "apartment",
      inputKey: "apartment",
    },
    country: {
      dbCol: "country",
      inputKey: "country",
    },
  },
};

export interface AuthCodeDBData {
  id: ID;
  created_at: Date;
  updated_at: Date;
  code: string;
  user_id: ID;
  email_address: string | null;
  phone_number: string | null;
}

const authCodeTable = "auth_codes";
const authCodeFields = [
  "id",
  "created_at",
  "updated_at",
  "code",
  "user_id",
  "email_address",
  "phone_number",
];

export const authCodeLoader = new ObjectLoaderFactory<AuthCodeDBData>({
  tableName: authCodeTable,
  fields: authCodeFields,
  key: "id",
});

export const authCodeLoaderInfo = {
  tableName: authCodeTable,
  fields: authCodeFields,
  nodeType: NodeType.AuthCode,
  loaderFactory: authCodeLoader,
  fieldInfo: {
    ID: {
      dbCol: "id",
      inputKey: "id",
    },
    createdAt: {
      dbCol: "created_at",
      inputKey: "createdAt",
    },
    updatedAt: {
      dbCol: "updated_at",
      inputKey: "updatedAt",
    },
    code: {
      dbCol: "code",
      inputKey: "code",
    },
    userID: {
      dbCol: "user_id",
      inputKey: "userID",
    },
    emailAddress: {
      dbCol: "email_address",
      inputKey: "emailAddress",
    },
    phoneNumber: {
      dbCol: "phone_number",
      inputKey: "phoneNumber",
    },
  },
};

export interface CommentDBData {
  id: ID;
  created_at: Date;
  updated_at: Date;
  author_id: ID;
  body: string;
  article_id: ID;
  article_type: string;
  attachment_id: ID | null;
  attachment_type: string | null;
  sticker_id: ID | null;
  sticker_type: string | null;
}

const commentTable = "comments";
const commentFields = [
  "id",
  "created_at",
  "updated_at",
  "author_id",
  "body",
  "article_id",
  "article_type",
  "attachment_id",
  "attachment_type",
  "sticker_id",
  "sticker_type",
];

export const commentLoader = new ObjectLoaderFactory<CommentDBData>({
  tableName: commentTable,
  fields: commentFields,
  key: "id",
});

export const commentLoaderInfo = {
  tableName: commentTable,
  fields: commentFields,
  nodeType: NodeType.Comment,
  loaderFactory: commentLoader,
  fieldInfo: {
    ID: {
      dbCol: "id",
      inputKey: "id",
    },
    createdAt: {
      dbCol: "created_at",
      inputKey: "createdAt",
    },
    updatedAt: {
      dbCol: "updated_at",
      inputKey: "updatedAt",
    },
    AuthorID: {
      dbCol: "author_id",
      inputKey: "authorID",
    },
    Body: {
      dbCol: "body",
      inputKey: "body",
    },
    ArticleID: {
      dbCol: "article_id",
      inputKey: "articleID",
    },
    ArticleType: {
      dbCol: "article_type",
      inputKey: "articleType",
    },
    AttachmentID: {
      dbCol: "attachment_id",
      inputKey: "attachmentID",
    },
    AttachmentType: {
      dbCol: "attachment_type",
      inputKey: "attachmentType",
    },
    StickerID: {
      dbCol: "sticker_id",
      inputKey: "stickerID",
    },
    StickerType: {
      dbCol: "sticker_type",
      inputKey: "stickerType",
    },
  },
};

export interface ContactDBData {
  id: ID;
  created_at: Date;
  updated_at: Date;
  email_ids: ID[];
  phone_number_ids: ID[];
  first_name: string;
  last_name: string;
  user_id: ID;
}

const contactTable = "contacts";
const contactFields = [
  "id",
  "created_at",
  "updated_at",
  "email_ids",
  "phone_number_ids",
  "first_name",
  "last_name",
  "user_id",
];

export const contactLoader = new ObjectLoaderFactory<ContactDBData>({
  tableName: contactTable,
  fields: contactFields,
  key: "id",
});

export const contactLoaderInfo = {
  tableName: contactTable,
  fields: contactFields,
  nodeType: NodeType.Contact,
  loaderFactory: contactLoader,
  fieldInfo: {
    ID: {
      dbCol: "id",
      inputKey: "id",
    },
    createdAt: {
      dbCol: "created_at",
      inputKey: "createdAt",
    },
    updatedAt: {
      dbCol: "updated_at",
      inputKey: "updatedAt",
    },
    email_ids: {
      dbCol: "email_ids",
      inputKey: "emailIds",
    },
    phone_number_ids: {
      dbCol: "phone_number_ids",
      inputKey: "phoneNumberIds",
    },
    firstName: {
      dbCol: "first_name",
      inputKey: "firstName",
    },
    lastName: {
      dbCol: "last_name",
      inputKey: "lastName",
    },
    userID: {
      dbCol: "user_id",
      inputKey: "userID",
    },
  },
};

export interface ContactEmailDBData {
  id: ID;
  created_at: Date;
  updated_at: Date;
  extra: ContactInfo | null;
  email_address: string;
  label: ContactLabel;
  contact_id: ID;
}

const contactEmailTable = "contact_emails";
const contactEmailFields = [
  "id",
  "created_at",
  "updated_at",
  "extra",
  "email_address",
  "label",
  "contact_id",
];

export const contactEmailLoader = new ObjectLoaderFactory<ContactEmailDBData>({
  tableName: contactEmailTable,
  fields: contactEmailFields,
  key: "id",
});

export const contactEmailLoaderInfo = {
  tableName: contactEmailTable,
  fields: contactEmailFields,
  nodeType: NodeType.ContactEmail,
  loaderFactory: contactEmailLoader,
  fieldInfo: {
    ID: {
      dbCol: "id",
      inputKey: "id",
    },
    createdAt: {
      dbCol: "created_at",
      inputKey: "createdAt",
    },
    updatedAt: {
      dbCol: "updated_at",
      inputKey: "updatedAt",
    },
    extra: {
      dbCol: "extra",
      inputKey: "extra",
    },
    emailAddress: {
      dbCol: "email_address",
      inputKey: "emailAddress",
    },
    label: {
      dbCol: "label",
      inputKey: "label",
    },
    contactID: {
      dbCol: "contact_id",
      inputKey: "contactID",
    },
  },
};

export interface ContactPhoneNumberDBData {
  id: ID;
  created_at: Date;
  updated_at: Date;
  extra: ContactInfo | null;
  phone_number: string;
  label: ContactLabel;
  contact_id: ID;
}

const contactPhoneNumberTable = "contact_phone_numbers";
const contactPhoneNumberFields = [
  "id",
  "created_at",
  "updated_at",
  "extra",
  "phone_number",
  "label",
  "contact_id",
];

export const contactPhoneNumberLoader =
  new ObjectLoaderFactory<ContactPhoneNumberDBData>({
    tableName: contactPhoneNumberTable,
    fields: contactPhoneNumberFields,
    key: "id",
  });

export const contactPhoneNumberLoaderInfo = {
  tableName: contactPhoneNumberTable,
  fields: contactPhoneNumberFields,
  nodeType: NodeType.ContactPhoneNumber,
  loaderFactory: contactPhoneNumberLoader,
  fieldInfo: {
    ID: {
      dbCol: "id",
      inputKey: "id",
    },
    createdAt: {
      dbCol: "created_at",
      inputKey: "createdAt",
    },
    updatedAt: {
      dbCol: "updated_at",
      inputKey: "updatedAt",
    },
    extra: {
      dbCol: "extra",
      inputKey: "extra",
    },
    phoneNumber: {
      dbCol: "phone_number",
      inputKey: "phoneNumber",
    },
    label: {
      dbCol: "label",
      inputKey: "label",
    },
    contactID: {
      dbCol: "contact_id",
      inputKey: "contactID",
    },
  },
};

export interface EventDBData {
  id: ID;
  created_at: Date;
  updated_at: Date;
  name: string;
  user_id: ID;
  start_time: Date;
  end_time: Date | null;
  location: string;
  address_id: ID | null;
  cover_photo: Buffer | null;
  cover_photo_2: Buffer | null;
}

const eventTable = "events";
const eventFields = [
  "id",
  "created_at",
  "updated_at",
  "name",
  "user_id",
  "start_time",
  "end_time",
  "location",
  "address_id",
  "cover_photo",
  "cover_photo_2",
];

export const eventLoader = new ObjectLoaderFactory<EventDBData>({
  tableName: eventTable,
  fields: eventFields,
  key: "id",
});

export const eventLoaderInfo = {
  tableName: eventTable,
  fields: eventFields,
  nodeType: NodeType.Event,
  loaderFactory: eventLoader,
  fieldInfo: {
    ID: {
      dbCol: "id",
      inputKey: "id",
    },
    createdAt: {
      dbCol: "created_at",
      inputKey: "createdAt",
    },
    updatedAt: {
      dbCol: "updated_at",
      inputKey: "updatedAt",
    },
    name: {
      dbCol: "name",
      inputKey: "name",
    },
    creatorID: {
      dbCol: "user_id",
      inputKey: "creatorID",
    },
    start_time: {
      dbCol: "start_time",
      inputKey: "startTime",
    },
    end_time: {
      dbCol: "end_time",
      inputKey: "endTime",
    },
    location: {
      dbCol: "location",
      inputKey: "location",
    },
    addressID: {
      dbCol: "address_id",
      inputKey: "addressID",
    },
    cover_photo: {
      dbCol: "cover_photo",
      inputKey: "coverPhoto",
    },
    cover_photo2: {
      dbCol: "cover_photo_2",
      inputKey: "coverPhoto2",
    },
  },
};

export interface HolidayDBData {
  id: ID;
  created_at: Date;
  updated_at: Date;
  day_of_week: DayOfWeek;
  day_of_week_alt: DayOfWeekAlt;
  label: string;
  date: Date;
}

const holidayTable = "holidays";
const holidayFields = [
  "id",
  "created_at",
  "updated_at",
  "day_of_week",
  "day_of_week_alt",
  "label",
  "date",
];

export const holidayLoader = new ObjectLoaderFactory<HolidayDBData>({
  tableName: holidayTable,
  fields: holidayFields,
  key: "id",
});

export const holidayLoaderInfo = {
  tableName: holidayTable,
  fields: holidayFields,
  nodeType: NodeType.Holiday,
  loaderFactory: holidayLoader,
  fieldInfo: {
    ID: {
      dbCol: "id",
      inputKey: "id",
    },
    createdAt: {
      dbCol: "created_at",
      inputKey: "createdAt",
    },
    updatedAt: {
      dbCol: "updated_at",
      inputKey: "updatedAt",
    },
    dayOfWeek: {
      dbCol: "day_of_week",
      inputKey: "dayOfWeek",
    },
    dayOfWeekAlt: {
      dbCol: "day_of_week_alt",
      inputKey: "dayOfWeekAlt",
    },
    label: {
      dbCol: "label",
      inputKey: "label",
    },
    date: {
      dbCol: "date",
      inputKey: "date",
    },
  },
};

export interface HoursOfOperationDBData {
  id: ID;
  created_at: Date;
  updated_at: Date;
  day_of_week: DayOfWeek;
  day_of_week_alt: DayOfWeekAlt | null;
  open: string;
  close: string;
}

const hoursOfOperationTable = "hours_of_operations";
const hoursOfOperationFields = [
  "id",
  "created_at",
  "updated_at",
  "day_of_week",
  "day_of_week_alt",
  "open",
  "close",
];

export const hoursOfOperationLoader =
  new ObjectLoaderFactory<HoursOfOperationDBData>({
    tableName: hoursOfOperationTable,
    fields: hoursOfOperationFields,
    key: "id",
  });

export const hoursOfOperationLoaderInfo = {
  tableName: hoursOfOperationTable,
  fields: hoursOfOperationFields,
  nodeType: NodeType.HoursOfOperation,
  loaderFactory: hoursOfOperationLoader,
  fieldInfo: {
    ID: {
      dbCol: "id",
      inputKey: "id",
    },
    createdAt: {
      dbCol: "created_at",
      inputKey: "createdAt",
    },
    updatedAt: {
      dbCol: "updated_at",
      inputKey: "updatedAt",
    },
    dayOfWeek: {
      dbCol: "day_of_week",
      inputKey: "dayOfWeek",
    },
    dayOfWeekAlt: {
      dbCol: "day_of_week_alt",
      inputKey: "dayOfWeekAlt",
    },
    open: {
      dbCol: "open",
      inputKey: "open",
    },
    close: {
      dbCol: "close",
      inputKey: "close",
    },
  },
};

export interface UserDBData {
  id: ID;
  created_at: Date;
  updated_at: Date;
  first_name: string;
  last_name: string;
  email_address: string;
  phone_number: string | null;
  password: string | null;
  account_status: UserAccountStatus | null;
  email_verified: boolean;
  bio: string | null;
  nicknames: string[] | null;
  prefs: UserPrefsStruct | null;
  prefs_list: UserPrefsStruct[] | null;
  prefs_diff: UserPrefsDiff | null;
  days_off: UserDaysOff[] | null;
  preferred_shift: UserPreferredShift[] | null;
  time_in_ms: BigInt | null;
  fun_uuids: ID[] | null;
  super_nested_object: UserSuperNestedObject | null;
  nested_list: UserNestedObjectList[] | null;
  int_enum: UserIntEnum | null;
}

const userTable = "users";
const userFields = [
  "id",
  "created_at",
  "updated_at",
  "first_name",
  "last_name",
  "email_address",
  "phone_number",
  "password",
  "account_status",
  "email_verified",
  "bio",
  "nicknames",
  "prefs",
  "prefs_list",
  "prefs_diff",
  "days_off",
  "preferred_shift",
  "time_in_ms",
  "fun_uuids",
  "nested_list",
  "int_enum",
];

export const userLoader = new ObjectLoaderFactory<UserDBData>({
  tableName: userTable,
  fields: userFields,
  key: "id",
});

export const userEmailAddressLoader = new ObjectLoaderFactory<UserDBData>({
  tableName: userTable,
  fields: userFields,
  key: "email_address",
});

export const userPhoneNumberLoader = new ObjectLoaderFactory<UserDBData>({
  tableName: userTable,
  fields: userFields,
  key: "phone_number",
});

export const userLoaderInfo = {
  tableName: userTable,
  fields: userFields,
  nodeType: NodeType.User,
  loaderFactory: userLoader,
  fieldInfo: {
    ID: {
      dbCol: "id",
      inputKey: "id",
    },
    createdAt: {
      dbCol: "created_at",
      inputKey: "createdAt",
    },
    updatedAt: {
      dbCol: "updated_at",
      inputKey: "updatedAt",
    },
    FirstName: {
      dbCol: "first_name",
      inputKey: "firstName",
    },
    LastName: {
      dbCol: "last_name",
      inputKey: "lastName",
    },
    EmailAddress: {
      dbCol: "email_address",
      inputKey: "emailAddress",
    },
    PhoneNumber: {
      dbCol: "phone_number",
      inputKey: "phoneNumber",
    },
    Password: {
      dbCol: "password",
      inputKey: "password",
    },
    AccountStatus: {
      dbCol: "account_status",
      inputKey: "accountStatus",
    },
    emailVerified: {
      dbCol: "email_verified",
      inputKey: "emailVerified",
    },
    Bio: {
      dbCol: "bio",
      inputKey: "bio",
    },
    nicknames: {
      dbCol: "nicknames",
      inputKey: "nicknames",
    },
    prefs: {
      dbCol: "prefs",
      inputKey: "prefs",
    },
    prefsList: {
      dbCol: "prefs_list",
      inputKey: "prefsList",
    },
    prefs_diff: {
      dbCol: "prefs_diff",
      inputKey: "prefsDiff",
    },
    daysOff: {
      dbCol: "days_off",
      inputKey: "daysOff",
    },
    preferredShift: {
      dbCol: "preferred_shift",
      inputKey: "preferredShift",
    },
    timeInMs: {
      dbCol: "time_in_ms",
      inputKey: "timeInMs",
    },
    fun_uuids: {
      dbCol: "fun_uuids",
      inputKey: "funUuids",
    },
    superNestedObject: {
      dbCol: "super_nested_object",
      inputKey: "superNestedObject",
    },
    nestedList: {
      dbCol: "nested_list",
      inputKey: "nestedList",
    },
    int_enum: {
      dbCol: "int_enum",
      inputKey: "intEnum",
    },
  },
};

userLoader.addToPrime(userEmailAddressLoader);
userLoader.addToPrime(userPhoneNumberLoader);
userEmailAddressLoader.addToPrime(userLoader);
userEmailAddressLoader.addToPrime(userPhoneNumberLoader);
userPhoneNumberLoader.addToPrime(userLoader);
userPhoneNumberLoader.addToPrime(userEmailAddressLoader);

export function getLoaderInfoFromSchema(schema: string) {
  switch (schema) {
    case "Address":
      return addressLoaderInfo;
    case "AuthCode":
      return authCodeLoaderInfo;
    case "Comment":
      return commentLoaderInfo;
    case "Contact":
      return contactLoaderInfo;
    case "ContactEmail":
      return contactEmailLoaderInfo;
    case "ContactPhoneNumber":
      return contactPhoneNumberLoaderInfo;
    case "Event":
      return eventLoaderInfo;
    case "Holiday":
      return holidayLoaderInfo;
    case "HoursOfOperation":
      return hoursOfOperationLoaderInfo;
    case "User":
      return userLoaderInfo;
    default:
      throw new Error(
        `invalid schema ${schema} passed to getLoaderInfoFromSchema`,
      );
  }
}

export function getLoaderInfoFromNodeType(nodeType: NodeType) {
  switch (nodeType) {
    case NodeType.Address:
      return addressLoaderInfo;
    case NodeType.AuthCode:
      return authCodeLoaderInfo;
    case NodeType.Comment:
      return commentLoaderInfo;
    case NodeType.Contact:
      return contactLoaderInfo;
    case NodeType.ContactEmail:
      return contactEmailLoaderInfo;
    case NodeType.ContactPhoneNumber:
      return contactPhoneNumberLoaderInfo;
    case NodeType.Event:
      return eventLoaderInfo;
    case NodeType.Holiday:
      return holidayLoaderInfo;
    case NodeType.HoursOfOperation:
      return hoursOfOperationLoaderInfo;
    case NodeType.User:
      return userLoaderInfo;
    default:
      throw new Error(
        `invalid nodeType ${nodeType} passed to getLoaderInfoFromNodeType`,
      );
  }
}
