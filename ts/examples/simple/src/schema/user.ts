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
} from "@lolopinto/ent/schema";
import { EmailType } from "@lolopinto/ent-email";
import { PasswordType } from "@lolopinto/ent-password";
import { PhoneNumberType } from "@lolopinto/ent-phonenumber";

export default class User extends BaseEntSchema implements Schema {
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
    StringType({ name: "AccountStatus", nullable: true }),
    BooleanType({
      name: "emailVerified",
      hideFromGraphQL: true,
      serverDefault: "FALSE",
    }),
    StringType({ name: "Bio", nullable: true }),
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

  // create, edit, delete
  // TODO we need editEmail, editPhoneNumber etc
  actions: Action[] = [
    {
      operation: ActionOperation.Create,
      fields: [
        "FirstName",
        "LastName",
        "EmailAddress",
        requiredField("PhoneNumber"),
        requiredField("Password"),
      ],
    },
    {
      operation: ActionOperation.Edit,
      // everything is optional by default in edits anyway
      fields: ["FirstName", "LastName"],
    },
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
    {
      // confirm email address with code
      operation: ActionOperation.Edit,
      actionName: "ConfirmEditEmailAddressAction",
      graphQLName: "confirmEditEmailAddressEdit",
      inputName: "ConfirmEditEmailAddressInput",
      actionOnlyFields: [{ name: "code", type: "String" }],
      // fields are default optional in edit mutation, this says make this required in here
      fields: [requiredField("EmailAddress")],
    },
    {
      operation: ActionOperation.Delete,
    },
  ];
}
