import {
  EntSchema,
  ActionOperation,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema";

const CommentSchema = new EntSchema({
  fields: {
    // don't want a foreign key but want to type the User
    AuthorID: UUIDType({ fieldEdge: { schema: "User" }, index: true }),
    Body: StringType(),
    // should be postID but don't want to conflict with existing post edge
    ArticleID: UUIDType({ polymorphic: true, index: true }),
    StickerID: UUIDType({ polymorphic: true, nullable: true }),
  },

  actions: [
    {
      operation: ActionOperation.Create,
    },
  ],
});
export default CommentSchema;
