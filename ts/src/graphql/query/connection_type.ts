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
import { Data, Ent, Viewer } from "../../core/base";

type nodeType = GraphQLObjectType | GraphQLInterfaceType;
export class GraphQLEdgeType<
  TNode extends nodeType,
  TEdge extends Data,
  TViewer extends Viewer,
> extends GraphQLObjectType {
  constructor(
    name: string,
    nodeType: TNode,
    optionalFields?: () => GraphQLFieldConfigMap<
      GraphQLEdge<TEdge>,
      RequestContext<TViewer>
    >,
  ) {
    let optional:
      | GraphQLFieldConfigMap<GraphQLEdge<TEdge>, RequestContext<TViewer>>
      | undefined;
    if (optionalFields) {
      optional = optionalFields();
    }
    super({
      name: `${name}Edge`,
      fields: (): GraphQLFieldConfigMap<
        GraphQLEdge<TEdge>,
        RequestContext<TViewer>
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

interface connectionOptions<T extends Data, TViewer extends Viewer> {
  fields?(): GraphQLFieldConfigMap<GraphQLEdge<T>, RequestContext<TViewer>>;
}

export class GraphQLConnectionType<
  TNode extends nodeType,
  TEdge extends Data,
  TViewer extends Viewer,
> extends GraphQLObjectType {
  edgeType: GraphQLEdgeType<TNode, TEdge, TViewer>;
  constructor(
    name: string,
    nodeType: TNode,
    options?: connectionOptions<TEdge, TViewer>,
  ) {
    const edgeType = new GraphQLEdgeType(name, nodeType, options?.fields);

    super({
      name: `${name}Connection`,
      fields: (): GraphQLFieldConfigMap<
        GraphQLEdgeConnection<Ent, TEdge, TViewer>,
        RequestContext<TViewer>
      > => ({
        edges: {
          type: new GraphQLNonNull(
            new GraphQLList(new GraphQLNonNull(edgeType)),
          ),
          resolve: (source: GraphQLEdgeConnection<Ent, TEdge, TViewer>) => {
            return source.queryEdges();
          },
        },
        nodes: {
          type: new GraphQLNonNull(
            new GraphQLList(new GraphQLNonNull(nodeType)),
          ),
          resolve: (source: GraphQLEdgeConnection<Ent, TEdge, TViewer>) => {
            return source.queryNodes();
          },
        },
        pageInfo: {
          type: new GraphQLNonNull(GraphQLPageInfo),
          resolve: (source: GraphQLEdgeConnection<Ent, TEdge, TViewer>) => {
            return source.queryPageInfo();
          },
        },
        rawCount: {
          type: new GraphQLNonNull(GraphQLInt),
          resolve: (source: GraphQLEdgeConnection<Ent, TEdge, TViewer>) => {
            return source.queryTotalCount();
          },
        },
      }),
      interfaces: [GraphQLConnectionInterface],
    });

    this.edgeType = edgeType;
  }
}
