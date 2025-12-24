import { GraphQLInterfaceType, GraphQLList, GraphQLNonNull } from "graphql";
import { GraphQLNodeInterface } from "./node.js";
import { GraphQLEdgeInterface } from "./edge.js";
import { GraphQLPageInfo } from "../query/page_info.js";

// NB: if this changes, need to update renderer.go also
export const GraphQLConnectionInterface = new GraphQLInterfaceType({
  name: "Connection",
  description: "connection interface",
  fields: () => ({
    edges: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLEdgeInterface)),
      ),
    },
    nodes: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLNodeInterface)),
      ),
    },
    pageInfo: {
      type: new GraphQLNonNull(GraphQLPageInfo),
    },
  }),
});
