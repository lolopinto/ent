import { ID, Ent, Viewer, loadEnt } from "../core/ent";

interface Node {
  id: ID;
}

export interface NodeResolver {
  encode(node: Node): string;
  decode(id: string): ID;
  decodeObj(viewer: Viewer, id: string): Promise<Node | null>;
}

// generated loadEntByType signature....
interface loadEnt {
  (v: Viewer, str: string, id: ID): Promise<Ent | null>;
}

export class EntNodeResolver implements NodeResolver {
  constructor(private loader: loadEnt) {}

  encode(node: Ent): string {
    const str = `${node.nodeType}:${node.id}`;
    return Buffer.from(str, "ascii").toString("base64");
  }

  decode(id: string): ID {
    const decoded = Buffer.from(id, "base64").toString("ascii");
    let parts = decoded.split(":");
    if (parts.length != 2) {
      throw new Error(`invalid id ${id} passed to EntNodeResolver`);
    }
    return parts[1];
  }

  async decodeObj(viewer: Viewer, id: string): Promise<Node | null> {
    const decoded = Buffer.from(id, "base64").toString("ascii");
    let parts = decoded.split(":");
    if (parts.length != 2) {
      throw new Error(`invalid id ${id} passed to EntNodeResolver`);
    }
    return this.loader(viewer, parts[0], parts[1]);
  }
}
