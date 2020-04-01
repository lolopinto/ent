import Schema, {
  Action,
  Field,
  Edge,
  BaseEntSchema,
  ActionOperation,
} from "ent/schema";
import { StringType } from "ent/field";

export default class User extends BaseEntSchema implements Schema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    StringType({ name: "EmailAddress", unique: true }),
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
      operation: ActionOperation.Mutations,
    },
  ];
}
