import {
  GraphQLFieldConfigMap,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLString,
} from "graphql";
import { RequestContext } from "../../core/context";
import { GraphQLEdge, GraphQLEdgeConnection } from "./edge_connection";
import { GraphQLPageInfo } from "./page_info";
import { GraphQLEdgeInterface } from "../builtins/edge";
import { GraphQLConnectionInterface } from "../builtins/connection";
import { Data, Ent } from "../../core/base";

type nodeType = GraphQLObjectType | GraphQLInterfaceType;
export class GraphQLEdgeType<
  TNode extends nodeType,
  TEdge extends Data,
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
          type: new GraphQLNonNull(nodeType),
        },
        cursor: {
          type: new GraphQLNonNull(GraphQLString),
        },
        ...optional,
      }),
      interfaces: [GraphQLEdgeInterface],
    });
  }
}

interface connectionOptions<T extends Data> {
  fields?(): GraphQLFieldConfigMap<GraphQLEdge<T>, RequestContext>;
}

export class GraphQLConnectionType<
  TNode extends nodeType,
  TEdge extends Data,
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
        GraphQLEdgeConnection<Ent, TEdge>,
        RequestContext
      > => ({
        edges: {
          type: new GraphQLNonNull(
            new GraphQLList(new GraphQLNonNull(edgeType)),
          ),
          resolve: (source: GraphQLEdgeConnection<Ent, TEdge>) => {
            return source.queryEdges();
          },
        },
        nodes: {
          type: new GraphQLNonNull(
            new GraphQLList(new GraphQLNonNull(nodeType)),
          ),
          resolve: (source: GraphQLEdgeConnection<Ent, TEdge>) => {
            return source.queryNodes();
          },
        },
        pageInfo: {
          type: new GraphQLNonNull(GraphQLPageInfo),
          resolve: (source: GraphQLEdgeConnection<Ent, TEdge>) => {
            return source.queryPageInfo();
          },
        },
        rawCount: {
          type: new GraphQLNonNull(GraphQLInt),
          resolve: (source: GraphQLEdgeConnection<Ent, TEdge>) => {
            return source.queryTotalCount();
          },
        },
      }),
      interfaces: [GraphQLConnectionInterface],
    });

    this.edgeType = edgeType;
  }
}
