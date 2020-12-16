import { GraphQLInterfaceType, GraphQLNonNull, GraphQLID } from "graphql";

export const GraphQLNodeInterface = new GraphQLInterfaceType({
  name: "Node",
  description: "node interface",
  fields: () => ({
    id: {
      type: GraphQLNonNull(GraphQLID),
    },
  }),
});
