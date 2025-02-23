import { ID, Ent, Viewer } from "../core/base";
import { loadEnt } from "../core/ent";
import { GraphQLFieldResolver } from "graphql";

interface Node {
  id: ID;
}

export interface NodeResolver {
  decodeObj(viewer: Viewer, id: string): Promise<Node | null>;
}

// generated loadEntByType signature....
interface loadEnt {
  (v: Viewer, nodeType: string, id: ID): Promise<Ent | null>;
}

function encodeHelper(nodeType: string, id: ID): string {
  return btoa(`node:${nodeType}:${id}`);
}

export class EntNodeResolver implements NodeResolver {
  constructor(private loader: loadEnt) {}

  encode(node: Ent): string {
    // let's do 3 parts. we take the "node" prefix
    return encodeHelper(node.nodeType, node.id);
  }

  static decode(id: string): ID | null {
    const decoded = atob(id);
    let parts = decoded.split(":");
    if (parts.length != 3) {
      return null;
    }
    return parts[2];
  }

  mustDecode(id: string): [ID, string] {
    const decoded = atob(id);
    let parts = decoded.split(":");
    if (parts.length != 3) {
      throw new Error(`invalid id ${id} passed to EntNodeResolver`);
    }
    return [parts[0], parts[1]];
  }

  async decodeObj(viewer: Viewer, id: string): Promise<Node | null> {
    const decoded = atob(id);
    let parts = decoded.split(":");
    if (parts.length != 3 || parts[0] != "node") {
      return null;
    }
    return this.loader(viewer, parts[1], parts[2]);
  }
}

let resolvers: Map<string, NodeResolver> = new Map();

// used to register a new NodeResolver
export async function registerResolver(name: string, resolver: NodeResolver) {
  resolvers.set(name, resolver);
}

// mainly needed for tests
export async function clearResolvers() {
  resolvers.clear();
}

export async function resolveID(
  viewer: Viewer,
  id: string,
): Promise<Node | null> {
  for (const [_, resolver] of resolvers) {
    const node = await resolver.decodeObj(viewer, id);
    if (node !== null) {
      return node;
    }
  }
  return null;
}

// this takes an id and uses the default node resolver which
// should have been registered as part of entcodegen and decodes
export const nodeIDEncoder: GraphQLFieldResolver<Ent, {}> = (
  source: Ent,
  _args: {},
) => {
  const r = resolvers.get("entNode") as EntNodeResolver;
  if (!r) {
    throw new Error(`cannot resolve id when entNode not previously registered`);
  }
  return r.encode(source);
};

// This takes a GraphQL id and converts it to an ent id
export function mustDecodeIDFromGQLID(id: string): ID {
  const decoded = EntNodeResolver.decode(id);
  if (!decoded) {
    throw new Error(`wasn't able to decode invalid ${id}`);
  }
  return decoded;
}

// TODO get the right (non-any) return type here. may need to change codegen to do the right thing here
export function mustDecodeNullableIDFromGQLID(
  id: string | null | undefined,
): any {
  // support undefined because fields in action
  if (id === null || id === undefined) {
    return id;
  }
  const decoded = EntNodeResolver.decode(id);
  if (!decoded) {
    throw new Error(`wasn't able to decode invalid ${id}`);
  }
  return decoded;
}

// This takes an ent and returns the graphql id
export function encodeGQLID(node: Ent): string {
  // let's do 3 parts. we take the "node" prefix
  return btoa(`node:${node.nodeType}:${node.id}`);
}
