import {
  Schema,
  BaseEntSchema,
  Field,
  StringType,
  Action,
  ActionOperation,
  UUIDType,
} from "@snowtop/ent/schema";

export default class Address extends BaseEntSchema implements Schema {
  fields: Field[] = [
    StringType({ name: "Street" }),
    StringType({ name: "City" }),
    StringType({ name: "State" }),
    StringType({ name: "ZipCode" }),
    StringType({ name: "Apartment", nullable: true }),
    UUIDType({
      name: "OwnerID",
      unique: true,
      polymorphic: true,
    }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
