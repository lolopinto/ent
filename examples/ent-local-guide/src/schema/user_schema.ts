import { ActionOperation, EntSchema, StringType } from "@snowtop/ent";

const UserSchema = new EntSchema({
  fields: {
    name: StringType(),
    slug: StringType({ unique: true }),
    bio: StringType({ nullable: true }),
  },

  edges: [
    {
      name: "favoritePlaces",
      schemaName: "Place",
      inverseEdge: {
        name: "fans",
      },
      edgeActions: [
        {
          operation: ActionOperation.AddEdge,
          actionName: "FavoritePlace",
        },
        {
          operation: ActionOperation.RemoveEdge,
          actionName: "UnfavoritePlace",
        },
      ],
    },
  ],

  actions: [
    {
      operation: ActionOperation.Create,
    },
    {
      operation: ActionOperation.Edit,
    },
    {
      operation: ActionOperation.Delete,
      hideFromGraphQL: true,
    },
  ],
});

export default UserSchema;
