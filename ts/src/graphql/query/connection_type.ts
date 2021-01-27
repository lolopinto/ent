import {
  GraphQLFieldConfigMap,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext } from "src/core/context";
import { GraphQLEdge, GraphQLEdgeConnection } from "./edge_connection";
import { GraphQLPageInfo } from "./page_info";
import { GraphQLEdgeInterface } from "../builtins/edge";
import { GraphQLConnectionInterface } from "../builtins/connection";
import { AssocEdge } from "src/core/ent";

export class GraphQLEdgeType<
  TNode extends GraphQLObjectType,
  TEdge extends AssocEdge
> extends GraphQLObjectType {
  constructor(name: string, nodeType: TNode) {
    super({
      name: `${name}Edge`,
      fields: (): GraphQLFieldConfigMap<
        GraphQLEdge<TEdge>,
        RequestContext
      > => ({
        node: {
          type: GraphQLNonNull(nodeType),
        },
        cursor: {
          type: GraphQLNonNull(GraphQLString),
          resolve: (obj: GraphQLEdge<TEdge>) => {
            return obj.edge.getCursor();
          },
        },
      }),
      interfaces: [GraphQLEdgeInterface],
    });
  }
}

export class GraphQLConnectionType<
  TNode extends GraphQLObjectType,
  TEdge extends AssocEdge
> extends GraphQLObjectType {
  constructor(name: string, nodeType: TNode) {
    const edgeType = new GraphQLEdgeType(name, nodeType);

    super({
      name: `${name}Connection`,
      fields: (): GraphQLFieldConfigMap<
        GraphQLEdgeConnection<TEdge>,
        RequestContext
      > => ({
        edges: {
          type: GraphQLNonNull(GraphQLList(GraphQLNonNull(edgeType))),
          resolve: (source: GraphQLEdgeConnection<TEdge>) => {
            return source.queryEdges();
          },
        },
        nodes: {
          type: GraphQLNonNull(GraphQLList(GraphQLNonNull(nodeType))),
          resolve: (source: GraphQLEdgeConnection<TEdge>) => {
            return source.queryNodes();
          },
        },
        pageInfo: {
          type: GraphQLNonNull(GraphQLPageInfo),
          resolve: (source: GraphQLEdgeConnection<TEdge>) => {
            return source.queryPageInfo();
          },
        },
        rawCount: {
          type: GraphQLNonNull(GraphQLInt),
          resolve: (source: GraphQLEdgeConnection<TEdge>) => {
            return source.queryTotalCount();
          },
        },
      }),
      interfaces: [GraphQLConnectionInterface],
    });
  }
}
