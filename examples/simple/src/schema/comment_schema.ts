import {
  EntSchema,
  ActionOperation,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema";

const CommentSchema = new EntSchema({
  fields: {
    // don't want a foreign key but want to type the User
    AuthorID: UUIDType({
      fieldEdge: {
        schema: "User",
      },
      index: true,
      immutable: true,
    }),
    Body: StringType(),
    // should be postID but don't want to conflict with existing post edge
    ArticleID: UUIDType({
      polymorphic: {
        types: ["User", "Comment"],
        name: "articles",
      },
      index: true,
    }),
    StickerID: UUIDType({ polymorphic: true, nullable: true }),
  },

  actions: [
    {
      operation: ActionOperation.Create,
    },
    {
      operation: ActionOperation.Edit,
    },
  ],
});
export default CommentSchema;
