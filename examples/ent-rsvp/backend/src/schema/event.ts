import {
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
  UUIDType,
  Action,
} from "@snowtop/ent";

export default class Event extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "Name" }),
    // start nullable so as to not break existing objects
    StringType({ name: "Slug", nullable: true, unique: true }),
    UUIDType({
      name: "creatorID",
      foreignKey: { schema: "User", column: "ID" },
      defaultToViewerOnCreate: true,
    }),
  ];

  actions: Action[] = [
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
  ];
}
