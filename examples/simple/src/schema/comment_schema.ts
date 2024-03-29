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
        indexEdge: {
          // we want a different one because we have a different name for "comments" based on pattern
          name: "comments_from_user",
        },
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
    AttachmentID: UUIDType({
      index: true,
      polymorphic: {
        // should be photo and video but we don't have those yet
        // types: ["Photo", "Video"],
        types: ["User", "Contact"],
        edgeConstName: "CommentsFromAttachment",
        name: "attachedComments",
      },
      nullable: true,
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
