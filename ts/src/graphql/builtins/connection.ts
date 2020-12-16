import { GraphQLInterfaceType, GraphQLList, GraphQLNonNull } from "graphql";
import { GraphQLNodeInterface } from "./node";
import { GraphQLEdgeInterface } from "./edge";
import { GraphQLPageInfo } from "../query/page_info";

export const GraphQLConnectionInterface = new GraphQLInterfaceType({
  name: "Connection",
  description: "connection interface",
  fields: () => ({
    edges: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLEdgeInterface))),
    },
    nodes: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLNodeInterface))),
    },
    pageInfo: {
      type: GraphQLNonNull(GraphQLPageInfo),
    },
  }),
});
