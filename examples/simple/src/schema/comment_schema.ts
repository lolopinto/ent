import {
  EntSchema,
  ActionOperation,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema";

const Comment = new EntSchema({
  fields: {
    // don't want a foreign key but want to type the User
    AuthorID: UUIDType({ fieldEdge: { schema: "User" } }),
    Body: StringType(),
    // should be postID but don't want to conflict with existing post edge
    ArticleID: UUIDType({ polymorphic: true, index: true }),
  },

  actions: [
    {
      operation: ActionOperation.Create,
    },
  ],
});
export default Comment;
