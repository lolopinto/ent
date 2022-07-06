import { ActionOperation, StringType, UUIDType, EntSchema } from "@snowtop/ent";

const EventSchema = new EntSchema({
  fields: {
    Name: StringType(),
    // start nullable so as to not break existing objects
    Slug: StringType({ nullable: true, unique: true }),
    creatorID: UUIDType({
      foreignKey: { schema: "User", column: "ID" },
      defaultToViewerOnCreate: true,
    }),
  },

  actions: [
    {
      operation: ActionOperation.Create,
      excludedFields: ["creatorID"],
      actionOnlyFields: [
        {
          name: "activities",
          list: true,
          nullable: true,
          type: "Object",
          actionName: "CreateEventActivityAction",
          excludedFields: ["eventID"],
        },
      ],
    },
    {
      operation: ActionOperation.Delete,
      hideFromGraphQL: true,
    },
  ],
});
export default EventSchema;
