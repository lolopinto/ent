import Schema, {
  Action,
  Field,
  Edge,
  BaseEntSchema,
  ActionOperation,
} from "ent/schema";
import { StringType, BooleanType } from "ent/field";
import { EmailType } from "ent/field/email";
import { PasswordType } from "ent/field/password";
import { PhoneNumberType } from "ent/field/phonenumber";

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
        "PhoneNumber",
        "Password",
      ],
    },
    {
      operation: ActionOperation.Edit,
      fields: ["FirstName", "LastName"],
    },
    {
      operation: ActionOperation.Delete,
    },
  ];
}
