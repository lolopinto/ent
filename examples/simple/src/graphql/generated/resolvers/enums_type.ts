/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { GraphQLEnumType } from "graphql";

export const CatBreedType = new GraphQLEnumType({
  name: "CatBreed",
  values: {
    BENGAL: {
      value: "bengal",
    },
    BURMESE: {
      value: "burmese",
    },
    HIMALAYAN: {
      value: "himalayan",
    },
    SOMALI: {
      value: "somali",
    },
    PERSIAN: {
      value: "persian",
    },
    SIAMESE: {
      value: "siamese",
    },
    TABBY: {
      value: "tabby",
    },
    OTHER: {
      value: "other",
    },
    UNKNOWN: {
      value: "%unknown%",
    },
  },
});

export const CommentSortColumnType = new GraphQLEnumType({
  name: "CommentSortColumn",
  values: {
    ARTICLE_ID: {
      value: "article_id",
    },
    ATTACHMENT_ID: {
      value: "attachment_id",
    },
    AUTHOR_ID: {
      value: "author_id",
    },
    ID: {
      value: "id",
    },
  },
});

export const ContactEmailSortColumnType = new GraphQLEnumType({
  name: "ContactEmailSortColumn",
  values: {
    ID: {
      value: "id",
    },
  },
});

export const ContactInfoSourceType = new GraphQLEnumType({
  name: "ContactInfoSource",
  values: {
    FRIEND: {
      value: "friend",
    },
    WORK: {
      value: "work",
    },
    ONLINE: {
      value: "online",
    },
    UNKNOWN: {
      value: "%unknown%",
    },
  },
});

export const ContactLabelType = new GraphQLEnumType({
  name: "ContactLabel",
  values: {
    WORK: {
      value: "work",
    },
    HOME: {
      value: "home",
    },
    DEFAULT: {
      value: "default",
    },
    UNKNOWN: {
      value: "unknown",
    },
    SELF: {
      value: "self",
    },
  },
});

export const ContactPhoneNumberSortColumnType = new GraphQLEnumType({
  name: "ContactPhoneNumberSortColumn",
  values: {
    ID: {
      value: "id",
    },
  },
});

export const ContactSortColumnType = new GraphQLEnumType({
  name: "ContactSortColumn",
  values: {
    EMAIL_IDS: {
      value: "email_ids",
    },
    ID: {
      value: "id",
    },
    PHONE_NUMBER_IDS: {
      value: "phone_number_ids",
    },
  },
});

export const DayOfWeekType = new GraphQLEnumType({
  name: "DayOfWeek",
  values: {
    SUNDAY: {
      value: "Sunday",
    },
    MONDAY: {
      value: "Monday",
    },
    TUESDAY: {
      value: "Tuesday",
    },
    WEDNESDAY: {
      value: "Wednesday",
    },
    THURSDAY: {
      value: "Thursday",
    },
    FRIDAY: {
      value: "Friday",
    },
    SATURDAY: {
      value: "Saturday",
    },
    UNKNOWN: {
      value: "%Unknown%",
    },
  },
});

export const DayOfWeekAltType = new GraphQLEnumType({
  name: "DayOfWeekAlt",
  values: {
    FRIDAY: {
      value: "fri",
    },
    MONDAY: {
      value: "mon",
    },
    SATURDAY: {
      value: "sat",
    },
    SUNDAY: {
      value: "sun",
    },
    THURSDAY: {
      value: "thu",
    },
    TUESDAY: {
      value: "tue",
    },
    UNKNOWN: {
      value: "%unknown%",
    },
    WEDNESDAY: {
      value: "wed",
    },
  },
});

export const DogBreedType = new GraphQLEnumType({
  name: "DogBreed",
  values: {
    GERMAN_SHEPHERD: {
      value: "german_shepherd",
    },
    LABRADOR: {
      value: "labrador",
    },
    POMERIAN: {
      value: "pomerian",
    },
    SIBERIAN_HUSKY: {
      value: "siberian_husky",
    },
    POODLE: {
      value: "poodle",
    },
    GOLDEN_RETRIEVER: {
      value: "golden_retriever",
    },
    OTHER: {
      value: "other",
    },
    UNKNOWN: {
      value: "%unknown%",
    },
  },
});

export const DogBreedGroupType = new GraphQLEnumType({
  name: "DogBreedGroup",
  values: {
    SPORTING: {
      value: "sporting",
    },
    HOUND: {
      value: "hound",
    },
    WORKING: {
      value: "working",
    },
    TERRIER: {
      value: "terrier",
    },
    TOY: {
      value: "toy",
    },
    NON_SPORTING: {
      value: "non_sporting",
    },
    HERDING: {
      value: "herding",
    },
    UNKNOWN: {
      value: "%unknown%",
    },
  },
});

export const EventRsvpStatusType = new GraphQLEnumType({
  name: "EventRsvpStatus",
  values: {
    ATTENDING: {
      value: "attending",
    },
    DECLINED: {
      value: "declined",
    },
    MAYBE: {
      value: "maybe",
    },
    CAN_RSVP: {
      value: "canRsvp",
    },
    UNKNOWN: {
      value: "%Unknown%",
    },
  },
});

export const EventSortColumnType = new GraphQLEnumType({
  name: "EventSortColumn",
  values: {
    CREATOR_ID: {
      value: "user_id",
    },
    ID: {
      value: "id",
    },
  },
});

export const HolidaySortColumnType = new GraphQLEnumType({
  name: "HolidaySortColumn",
  values: {
    ID: {
      value: "id",
    },
  },
});

export const HoursOfOperationSortColumnType = new GraphQLEnumType({
  name: "HoursOfOperationSortColumn",
  values: {
    ID: {
      value: "id",
    },
  },
});

export const IntEnumUsedInListType = new GraphQLEnumType({
  name: "IntEnumUsedInList",
  values: {
    UNKNOWN: {
      value: -9007199254740991,
    },
    YES: {
      value: 1,
    },
    NO: {
      value: 2,
    },
    MAYBE: {
      value: 3,
    },
  },
});

export const NotifTypeType = new GraphQLEnumType({
  name: "NotifType",
  values: {
    MOBILE: {
      value: "MOBILE",
    },
    WEB: {
      value: "WEB",
    },
    EMAIL: {
      value: "EMAIL",
    },
    UNKNOWN: {
      value: "%UNKNOWN%",
    },
  },
});

export const RabbitBreedType = new GraphQLEnumType({
  name: "RabbitBreed",
  values: {
    AMERICAN_RABBIT: {
      value: "american_rabbit",
    },
    AMERICAN_CHINCILLA: {
      value: "american_chincilla",
    },
    AMERICAN_FUZZY_LOP: {
      value: "american_fuzzy_lop",
    },
    AMERICAN_SABLE: {
      value: "american_sable",
    },
    ARGENTE_BRUN: {
      value: "argente_brun",
    },
    BELGIAN_HARE: {
      value: "belgian_hare",
    },
    BEVEREN: {
      value: "beveren",
    },
    OTHER: {
      value: "other",
    },
    UNKNOWN: {
      value: "%unknown%",
    },
  },
});

export const ResponseTypeType = new GraphQLEnumType({
  name: "ResponseType",
  values: {
    YES: {
      value: "yes",
    },
    NO: {
      value: "no",
    },
    MAYBE: {
      value: "maybe",
    },
    UNKNOWN: {
      value: "%unknown%",
    },
  },
});

export const UserAccountStatusType = new GraphQLEnumType({
  name: "UserAccountStatus",
  values: {
    UNVERIFIED: {
      value: "UNVERIFIED",
    },
    VERIFIED: {
      value: "VERIFIED",
    },
    DEACTIVATED: {
      value: "DEACTIVATED",
    },
    DISABLED: {
      value: "DISABLED",
    },
    UNKNOWN: {
      value: "%UNKNOWN%",
    },
  },
});

export const UserDaysOffType = new GraphQLEnumType({
  name: "UserDaysOff",
  values: {
    MONDAY: {
      value: "monday",
    },
    TUESDAY: {
      value: "tuesday",
    },
    WEDNESDAY: {
      value: "wednesday",
    },
    THURSDAY: {
      value: "thursday",
    },
    FRIDAY: {
      value: "friday",
    },
    SATURDAY: {
      value: "saturday",
    },
    SUNDAY: {
      value: "sunday",
    },
  },
});

export const UserIntEnumType = new GraphQLEnumType({
  name: "UserIntEnum",
  values: {
    VERIFIED: {
      value: 1,
    },
    UNVERIFIED: {
      value: 2,
    },
    DISABLED: {
      value: 3,
    },
    DEACTIVATED: {
      value: 4,
    },
  },
});

export const UserPreferredShiftType = new GraphQLEnumType({
  name: "UserPreferredShift",
  values: {
    MORNING: {
      value: "morning",
    },
    AFTERNOON: {
      value: "afternoon",
    },
    EVENING: {
      value: "evening",
    },
    GRAVEYARD: {
      value: "graveyard",
    },
    UNKNOWN: {
      value: "%unknown%",
    },
  },
});

export const UserSortColumnType = new GraphQLEnumType({
  name: "UserSortColumn",
  values: {
    ID: {
      value: "id",
    },
  },
});