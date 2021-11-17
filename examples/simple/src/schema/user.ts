import {
  Schema,
  Action,
  Field,
  Edge,
  BaseEntSchema,
  ActionOperation,
  StringType,
  BooleanType,
  requiredField,
  NoFields,
  JSONBType,
  JSONType,
  EnumListType,
  BigIntegerType,
  JSONBListType,
} from "@snowtop/ent/schema";
import { EmailType } from "@snowtop/ent-email";
import { PasswordType } from "@snowtop/ent-password";
import { PhoneNumberType } from "@snowtop/ent-phonenumber";
import { StringListType } from "@snowtop/ent/schema/field";
import Feedback from "./patterns/feedback";
import { UUIDListType } from "../../../../ts/dist";

export default class User extends BaseEntSchema implements Schema {
  constructor() {
    super();
    this.addPatterns(new Feedback());
  }

  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    EmailType({ name: "EmailAddress", unique: true }),
    // TODO shouldn't really be nullable. same issue as #35
    PhoneNumberType({
      name: "PhoneNumber",
      unique: true,
      nullable: true,
    }),
    // TODO shouldn't really be nullable. same issue as #35
    // TODO we need a way to say a field can be nullable in db but required in actions for new actions
    PasswordType({ name: "Password", nullable: true }),
    // TODO support enums: UNVERIFIED, VERIFIED, DEACTIVATED, DISABLED etc.
    // TODO shouldn't really be nullable. same issue as #35
    StringType({
      name: "AccountStatus",
      nullable: true,
      defaultValueOnCreate: () => "UNVERIFIED",
    }),
    BooleanType({
      name: "emailVerified",
      hideFromGraphQL: true,
      serverDefault: "FALSE",
      // not needed because we have serverDefault but can also set it here.
      defaultValueOnCreate: () => false,
    }),
    StringType({ name: "Bio", nullable: true }),
    StringListType({ name: "nicknames", nullable: true }),
    JSONBType({
      name: "prefs",
      nullable: true,
      importType: {
        path: "src/ent/user_prefs",
        type: "UserPrefs",
      },
    }),
    JSONBListType({
      name: "prefsList",
      nullable: true,
      importType: {
        path: "src/ent/user_prefs",
        type: "UserPrefs",
      },
    }),
    JSONType({
      name: "prefs_diff",
      nullable: true,
      validator: (val: any) => {
        if (typeof val != "object") {
          return false;
        }
        const requiredKeys = {
          type: true,
        };
        for (const k in requiredKeys) {
          if (!val[k]) {
            return false;
          }
        }
        return true;
      },
    }),
    EnumListType({
      name: "daysOff",
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
    EnumListType({
      name: "preferredShift",
      nullable: true,
      values: ["morning", "afternoon", "evening", "graveyard"],
    }),
    // Date.now() is too big to store in int so have to use bigint. because of how big bigint could get, have to use BigInt instead of number
    BigIntegerType({
      name: "timeInMs",
      nullable: true,
      defaultValueOnCreate: () => BigInt(Date.now()),
    }),
    UUIDListType({ name: "fun_uuids", nullable: true }),
    StringType({ name: "new_col", nullable: true }),
    StringType({ name: "new_col2", nullable: true }),
  ];

  edges: Edge[] = [
    {
      name: "createdEvents",
      schemaName: "Event",
    },
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
  ];

  actions: Action[] = [
    // create user
    {
      operation: ActionOperation.Create,
      fields: [
        "FirstName",
        "LastName",
        "EmailAddress",
        requiredField("PhoneNumber"),
        requiredField("Password"),
        "nicknames",
        "prefs",
        "prefs_diff",
        "daysOff",
        "preferredShift",
        "fun_uuids",
        "prefsList",
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
  ];
}
