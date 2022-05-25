import {
  EntSchema,
  ActionOperation,
  StringType,
  BooleanType,
  requiredField,
  NoFields,
  EnumListType,
  BigIntegerType,
  UUIDListType,
  StructType,
  UUIDType,
  StructListType,
  IntegerType,
  FloatType,
  EnumType,
  IntegerListType,
  UnionType,
  TimestampType,
} from "@snowtop/ent/schema";
import { EmailType } from "@snowtop/ent-email";
import { PasswordType } from "@snowtop/ent-password";
import { PhoneNumberType } from "@snowtop/ent-phonenumber";
import { StringListType } from "@snowtop/ent/schema/field";
import Feedback from "./patterns/feedback";
import { AllowIfViewerPrivacyPolicy } from "@snowtop/ent";

const UserSchema = new EntSchema({
  patterns: [new Feedback()],

  fields: {
    FirstName: StringType(),
    LastName: StringType(),
    EmailAddress: EmailType({ unique: true }),
    // TODO shouldn't really be nullable. same issue as #35
    PhoneNumber: PhoneNumberType({
      unique: true,
      nullable: true,
    }),
    // TODO shouldn't really be nullable. same issue as #35
    // TODO we need a way to say a field can be nullable in db but required in actions for new actions
    Password: PasswordType({ nullable: true }),
    // TODO support enums: UNVERIFIED, VERIFIED, DEACTIVATED, DISABLED etc.
    // TODO shouldn't really be nullable. same issue as #35
    AccountStatus: StringType({
      nullable: true,
      // allows scripts, internal tools etc to set this but not graphql
      disableUserGraphQLEditable: true,
      defaultValueOnCreate: () => "UNVERIFIED",
      privacyPolicy: AllowIfViewerPrivacyPolicy,
    }),
    emailVerified: BooleanType({
      hideFromGraphQL: true,
      serverDefault: "FALSE",
      // not needed because we have serverDefault but can also set it here.
      defaultValueOnCreate: () => false,
      privacyPolicy: AllowIfViewerPrivacyPolicy,
    }),
    Bio: StringType({ nullable: true }),
    nicknames: StringListType({ nullable: true }),
    prefs: StructType({
      tsType: "UserPrefsStruct",
      nullable: true,
      fields: {
        finishedNux: BooleanType({ nullable: true }),
        enableNotifs: BooleanType({ nullable: true }),
        notifTypes: EnumListType({
          values: ["MOBILE", "WEB", "EMAIL"],
          tsType: "NotifType",
          graphQLType: "NotifType",
        }),
      },
      privacyPolicy: AllowIfViewerPrivacyPolicy,
    }),
    // TODO there should be a way to share structs across types
    // this is the same type across multiple fields
    // more likely to be shared across types
    prefsList: StructListType({
      tsType: "UserPrefsStruct2",
      nullable: true,
      fields: {
        finishedNux: BooleanType({ nullable: true }),
        enableNotifs: BooleanType({ nullable: true }),
        notifTypes: EnumListType({
          values: ["MOBILE", "WEB", "EMAIL"],
          tsType: "NotifType2",
          graphQLType: "NotifType2",
        }),
      },
      privacyPolicy: AllowIfViewerPrivacyPolicy,
    }),
    prefs_diff: StructType({
      tsType: "UserPrefsDiff",
      nullable: true,
      privacyPolicy: AllowIfViewerPrivacyPolicy,
      jsonNotJSONB: true,
      fields: {
        type: StringType(),
      },
    }),
    daysOff: EnumListType({
      nullable: true,
      values: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
    }),
    preferredShift: EnumListType({
      nullable: true,
      values: ["morning", "afternoon", "evening", "graveyard"],
    }),
    // Date.now() is too big to store in int so have to use bigint. because of how big bigint could get, have to use BigInt instead of number
    timeInMs: BigIntegerType({
      nullable: true,
      defaultValueOnCreate: () => BigInt(Date.now()),
    }),
    fun_uuids: UUIDListType({ nullable: true }),
    new_col: StringType({ nullable: true }),
    new_col2: StringType({ nullable: true }),
    superNestedObject: StructType({
      nullable: true,
      tsType: "UserSuperNestedObject",
      graphQLType: "UserSuperNestedObject",
      fields: {
        uuid: UUIDType(),
        int: IntegerType(),
        string: StringType(),
        bool: BooleanType(),
        float: FloatType(),
        // this should be UserSuperNestedObject + Enum
        enum: EnumType({ values: ["yes", "no", "maybe"] }),
        string_list: StringListType({ nullable: true }),
        int_list: IntegerListType(),
        obj: StructType({
          nullable: true,
          tsType: "UserNestedObject",
          fields: {
            nested_uuid: UUIDType(),
            nested_int: IntegerType(),
            nested_string: StringType(),
            nested_bool: BooleanType(),
            nested_float: FloatType({ nullable: true }),
            // UserSuperNestedObjectNestedEnum
            nested_enum: EnumType({ values: ["yes", "no", "maybe"] }),
            nested_string_list: StringListType(),
            nested_int_list: IntegerListType(),
            nested_obj: StructType({
              nullable: true,
              tsType: "UserNestedNestedObject",
              fields: {
                nested_nested_uuid: UUIDType(),
                nested_nested_int: IntegerType(),
                nested_nested_string: StringType(),
                nested_nested_bool: BooleanType({ nullable: true }),
                nested_nested_float: FloatType(),
                // UserSuperObjectNestedNestedEnum
                nested_nested_enum: EnumType({
                  values: ["yes", "no", "maybe"],
                }),
                nested_nested_string_list: StringListType(),
                nested_nested_int_list: IntegerListType(),
              },
            }),
          },
        }),
        // TODO we need list types...
        // e.g. multiple pets
        union: UnionType({
          nullable: true,
          tsType: "PetUnionType",
          fields: {
            cat: StructType({
              tsType: "CatType",
              fields: {
                name: StringType(),
                birthday: TimestampType(),
                breed: EnumType({
                  tsType: "CatBreed",
                  graphQLType: "CatBreed",
                  values: [
                    "bengal",
                    "burmese",
                    "himalayan",
                    "somali",
                    "persian",
                    "siamese",
                    "tabby",
                    "other",
                  ],
                }),
                kitten: BooleanType(),
              },
            }),
            dog: StructType({
              tsType: "DogType",
              graphQLType: "DogType",
              fields: {
                name: StringType(),
                birthday: TimestampType(),
                breed: EnumType({
                  tsType: "DogBreed",
                  graphQLType: "DogBreed",
                  values: [
                    "german_shepherd",
                    "labrador",
                    "pomerian",
                    "siberian_husky",
                    "poodle",
                    "golden_retriever",
                    "other",
                  ],
                }),
                // https://www.akc.org/expert-advice/lifestyle/7-akc-dog-breed-groups-explained/
                breedGroup: EnumType({
                  tsType: "DogBreedGroup",
                  graphQLType: "DogBreedGroup",
                  values: [
                    "sporting",
                    "hound",
                    "working",
                    "terrier",
                    "toy",
                    "non_sporting",
                    "herding",
                  ],
                }),
                puppy: BooleanType(),
              },
            }),
            rabbit: StructType({
              tsType: "RabbitType",
              fields: {
                name: StringType(),
                birthday: TimestampType(),
                breed: EnumType({
                  tsType: "RabbitBreed",
                  graphQLType: "RabbitBreed",
                  values: [
                    "american_rabbit",
                    "american_chincilla",
                    "american_fuzzy_lop",
                    "american_sable",
                    "argente_brun",
                    "belgian_hare",
                    "beveren",
                    "other",
                  ],
                }),
              },
            }),
          },
        }),
      },
    }),
    nestedList: StructListType({
      nullable: true,
      tsType: "UserNestedObjectList",
      fields: {
        type: StringType(),
        enum: EnumType({
          values: ["yes", "no", "maybe"],
          tsType: "EnumUsedInList",
          graphQLType: "EnumUsedInList",
        }),
        objects: StructListType({
          tsType: "UserNestedNestedObjectList",
          fields: {
            int: IntegerType(),
          },
        }),
      },
    }),
  },

  edges: [
    {
      name: "friends",
      schemaName: "User",
      symmetric: true,
    },
    {
      name: "selfContact",
      unique: true,
      schemaName: "Contact",
    },
  ],

  indices: [
    {
      name: "user_name_idx",
      columns: ["FirstName", "LastName"],
      fulltext: {
        language: "simple",
        indexType: "gin",
        generatedColumnName: "name_idx",
      },
    },
  ],

  actions: [
    // create user
    {
      operation: ActionOperation.Create,
      requiredFields: ["PhoneNumber", "Password"],
      fields: [
        "FirstName",
        "LastName",
        "AccountStatus",
        "EmailAddress",
        "PhoneNumber",
        "Password",
        "nicknames",
        "prefs",
        "prefs_diff",
        "daysOff",
        "preferredShift",
        "fun_uuids",
        "prefsList",
        "superNestedObject",
        "nestedList",
      ],
    },

    // edit user: just first name and last name since the rest involve complex things happening
    {
      operation: ActionOperation.Edit,
      // everything is optional by default in edits

      fields: ["FirstName", "LastName"],
    },
    // edit password left as an exercise to the reader

    // send confirmation code for email address
    {
      // we're not saving anything in the db so we use actionOnlyField to specify a required email address
      // send email out
      operation: ActionOperation.Edit,
      actionName: "EditEmailAddressAction",
      graphQLName: "emailAddressEdit",
      inputName: "EditEmailAddressInput",
      // still need no fields even when we want only actionOnlyFields
      fields: [NoFields],
      // we use actionOnlyField here so emailAddress is not saved

      // we use a different field name so that field is not saved
      // TODO we also need a way to unset a field in builder if we also want to
      // use emailAddress
      actionOnlyFields: [{ name: "newEmail", type: "String" }],
    },

    // confirm email address with code sent in last time
    {
      operation: ActionOperation.Edit,
      actionName: "ConfirmEditEmailAddressAction",
      graphQLName: "confirmEmailAddressEdit",
      inputName: "ConfirmEditEmailAddressInput",
      actionOnlyFields: [{ name: "code", type: "String" }],
      // fields are default optional in edit mutation, this says make this required in here
      fields: [requiredField("EmailAddress")],
    },

    // send confirmation code for phone number
    {
      // we're not saving anything in the db so we use actionOnlyField to specify a required phone number
      // send text to code
      operation: ActionOperation.Edit,
      actionName: "EditPhoneNumberAction",
      graphQLName: "phoneNumberEdit",
      inputName: "EditPhoneNumberInput",
      // still need no fields even when we want only actionOnlyFields
      fields: [NoFields],
      // we use actionOnlyField here so phoneNumber is not saved

      // we use a different field name so that field is not saved
      // TODO we also need a way to unset a field in builder if we also want to
      // use phoneNumber
      actionOnlyFields: [{ name: "newPhoneNumber", type: "String" }],
    },

    // confirm phone number with code given
    {
      operation: ActionOperation.Edit,
      actionName: "ConfirmEditPhoneNumberAction",
      graphQLName: "confirmPhoneNumberEdit",
      inputName: "ConfirmEditPhoneNumberInput",
      actionOnlyFields: [{ name: "code", type: "String" }],
      // slightly different from email case above. this is an optional field that's
      // required in this scenario
      // we're overriding both all fields are default optional in edit AND
      // overriding phoneNumber is nullable in user object
      fields: [requiredField("PhoneNumber")],
    },

    // delete user
    {
      operation: ActionOperation.Delete,
    },
    {
      // contrived action that takes actionOnlyFields to add to input
      operation: ActionOperation.Delete,
      actionOnlyFields: [
        {
          type: "Boolean",
          name: "log",
        },
      ],
      actionName: "DeleteUserAction2",
      inputName: "DeleteUserInput2",
      graphQLName: "userDelete2",
    },
  ],
});
export default UserSchema;
