import {
  Action,
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
  EnumType,
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
    //really just exists for https://github.com/lolopinto/ent/issues/636
    EnumType({
      name: "source",
      tsType: "GuestDataSource",
      graphQLType: "GuestDataSource",
      nullable: true,
      values: ["event_page", "home_page"],
    }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
