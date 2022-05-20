import { GraphQLInterfaceType, GraphQLNonNull, GraphQLID } from "graphql";

// NB: if this changes, need to update renderer.go also
export const GraphQLNodeInterface = new GraphQLInterfaceType({
  name: "Node",
  description: "node interface",
  fields: () => ({
    id: {
      type: new GraphQLNonNull(GraphQLID),
    },
  }),
});
