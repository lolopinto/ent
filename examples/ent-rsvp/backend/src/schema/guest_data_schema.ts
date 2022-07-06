import {
  ActionOperation,
  StringType,
  EnumType,
  UUIDType,
  EntSchema,
} from "@snowtop/ent/schema";

const GuestDataSchema = new EntSchema({
  hideFromGraphQL: true,

  fields: {
    guestID: UUIDType({
      foreignKey: { schema: "Guest", column: "ID" },
    }),
    eventID: UUIDType({
      foreignKey: { schema: "Event", column: "ID" },
    }),
    dietaryRestrictions: StringType(),
    //really just exists for https://github.com/lolopinto/ent/issues/636
    source: EnumType({
      tsType: "GuestDataSource",
      graphQLType: "GuestDataSource",
      nullable: true,
      values: ["event_page", "home_page"],
    }),
  },

  actions: [
    {
      operation: ActionOperation.Mutations,
    },
  ],
});
export default GuestDataSchema;
