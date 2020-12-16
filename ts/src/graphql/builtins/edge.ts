import { GraphQLInterfaceType, GraphQLNonNull, GraphQLString } from "graphql";
import { GraphQLNodeInterface } from "./node";

export const GraphQLEdgeInterface = new GraphQLInterfaceType({
  name: "Edge",
  description: "edge interface",
  fields: () => ({
    node: {
      type: GraphQLNonNull(GraphQLNodeInterface),
    },
    cursor: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
});
