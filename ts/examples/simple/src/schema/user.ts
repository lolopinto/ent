import Schema, {
  Action,
  Field,
  Edge,
  BaseEntSchema,
  ActionOperation,
} from "ent/schema";
import { StringType, BooleanType } from "ent/field";
import { EmailType } from "ent/field/email";

export default class User extends BaseEntSchema implements Schema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    EmailType({ name: "EmailAddress", unique: true }),
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
  // TODO break edit into editEmail or something
  actions: Action[] = [
    {
      operation: ActionOperation.Create,
      fields: ["FirstName", "LastName", "EmailAddress"],
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
