import {
  Action,
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
  UUIDType,
} from "@lolopinto/ent/schema";

export default class GuestData extends BaseEntSchema {
  hideFromGraphQL = true;

  fields: Field[] = [
    UUIDType({
      name: "guestID",
      foreignKey: ["Guest", "ID"],
    }),
    UUIDType({
      name: "eventID",
      foreignKey: ["Event", "ID"],
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
