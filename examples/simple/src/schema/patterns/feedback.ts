import { Edge, Field, Pattern } from "@snowtop/ent";

export default class Feedback implements Pattern {
  name = "feedback";
  fields: Field[] = [];
  edges: Edge[] = [
    {
      // object to liker
      name: "likers",
      // specify schemaName Ent for eventual polymorphic?
      // do we want polymorphic: true
      // or for these, just have
      schemaName: "User",
      // id2 is User actually so that's fine
      // likes -> User
      inverseEdge: {
        name: "likes",
        edgeConstName: "UserToLikes",
      },
      edgeConstName: "ObjectToLikers",
    },
    {
      // object to comments
      name: "comments",
      schemaName: "Comment",
      inverseEdge: {
        // this is an inverse edge. const will be UserToPost when it should be CommentToPost
        // there is actually only going to be one of this and it should be a field stored in the comment object
        name: "post",
      },
    },
  ];
}
