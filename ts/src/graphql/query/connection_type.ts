import {
  GraphQLFieldConfigMap,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext } from "../../core/context";
import { GraphQLEdge, GraphQLEdgeConnection } from "./edge_connection";
import { GraphQLPageInfo } from "./page_info";
import { GraphQLEdgeInterface } from "../builtins/edge";
import { GraphQLConnectionInterface } from "../builtins/connection";
import { AssocEdge } from "../../core/ent";

export class GraphQLEdgeType<
  TNode extends GraphQLObjectType,
  TEdge extends AssocEdge
> extends GraphQLObjectType {
  constructor(
    name: string,
    nodeType: TNode,
    optionalFields?: () => GraphQLFieldConfigMap<
      GraphQLEdge<TEdge>,
      RequestContext
    >,
  ) {
    let optional:
      | GraphQLFieldConfigMap<GraphQLEdge<TEdge>, RequestContext>
      | undefined;
    if (optionalFields) {
      optional = optionalFields();
    }
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
        },
        ...optional,
      }),
      interfaces: [GraphQLEdgeInterface],
    });
  }
}

interface connectionOptions<T extends AssocEdge> {
  fields?(): GraphQLFieldConfigMap<GraphQLEdge<T>, RequestContext>;
}

export class GraphQLConnectionType<
  TNode extends GraphQLObjectType,
  TEdge extends AssocEdge
> extends GraphQLObjectType {
  edgeType: GraphQLEdgeType<TNode, TEdge>;
  constructor(
    name: string,
    nodeType: TNode,
    options?: connectionOptions<TEdge>,
  ) {
    const edgeType = new GraphQLEdgeType(name, nodeType, options?.fields);

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

    this.edgeType = edgeType;
  }
}
