import Schema, { Field, Edge, BaseEntSchema } from "ent/schema";
import { StringType } from "ent/field";

export default class User extends BaseEntSchema implements Schema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
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
  ];
}
