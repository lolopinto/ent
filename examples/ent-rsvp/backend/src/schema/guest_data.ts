import {
  Action,
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema";

export default class GuestData extends BaseEntSchema {
  hideFromGraphQL = true;

  fields: Field[] = [
    UUIDType({
      name: "guestID",
      foreignKey: { schema: "Guest", column: "ID" },
    }),
    UUIDType({
      name: "eventID",
      foreignKey: { schema: "Event", column: "ID" },
    }),
    StringType({
      name: "dietaryRestrictions",
    }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
