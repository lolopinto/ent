//import { Edge } from "src/schema";
import { ID, AssocEdge, Ent, Viewer, loadEdges } from "./ent";

export interface EdgeQuery<T extends Ent> {
  queryEdges(): Promise<AssocEdge[]>;
  queryIDs(): Promise<ID[]>;
  queryCount(): Promise<number>;
  queryEnts(): Promise<T[]>;
  limit(n: number): EdgeQuery<T>;
  firstN(n: number): EdgeQuery<T>;
  lastN(n: number): EdgeQuery<T>;
  // TODO where queries etc
  //  where(query.Cla)
  // TODO cursors
}

interface Cursor {}

class BaseEdgeQuery<T extends Ent> {
  constructor(
    private viewer: Viewer,
    private ent: T,
    private edgeType: string,
  ) {}

  // TODO filters
  queryEdges(): Promise<AssocEdge[]> {
    return loadEdges({
      id1: this.ent.id,
      edgeType: this.edgeType,
      context: this.viewer.context,
    });
  }
}
