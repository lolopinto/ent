import {
  ID,
  Ent,
  AssocEdgeInput,
  Viewer,
  EntConstructor,
  AssocEdgeInputOptions,
  DataOperation,
  CreateEdgeOperation,
  AssocEdgeData,
  Queryer,
} from "./ent";
import { ActionOperation, Builder } from "./action";

export interface OrchestratorOptions<T extends Ent> {
  // coming from
  tableName: string;
  ent?: EntConstructor<T>; // should be nullable for
  existingEnt?: Ent; // allowed to be null for create

  // Todo build fields
}

function randomNum(): string {
  return Math.random()
    .toString(10)
    .substring(2);
}

export class Orchestrator<T extends Ent> {
  public readonly placeholderID: ID;

  // this should be edge operations...
  private edgeOps: EdgeOperation<T>[] = [];
  private edgeSet: Set<string> = new Set<string>();
  existingEnt: Ent | undefined;

  constructor(
    public readonly viewer: Viewer,
    public readonly operation: ActionOperation,
    private options: OrchestratorOptions<T>,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}`;

    this.existingEnt = options.existingEnt;
  }

  addInboundEdge(
    id1: ID | Builder<T>,
    edgeType: string,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ) {
    this.edgeOps.push(EdgeOperation.inboundEdge(edgeType, id1, nodeType, this));
    this.edgeSet.add(edgeType);
  }

  addOutboundEdge(
    id2: ID | Builder<T>,
    edgeType: string,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ) {
    // TODO
  }

  removeInboundEdge(id1: ID, edgeType: string, nodeType: string) {
    // TODO
  }

  removeOutboundEdge(id2: ID, edgeType: string, nodeType: string) {
    // TODO
  }
}

// TODO implements DataOperation and move functionality away
class EdgeOperation<T extends Ent> implements DataOperation {
  private createRow: DataOperation;
  private constructor(edge: AssocEdgeInput) {
    // TODO
    this.createRow = new CreateEdgeOperation(edge, new AssocEdgeData({}));
  }

  performWrite(q: Queryer): Promise<void> {
    return this.createRow.performWrite(q);
  }

  static inboundEdge<T extends Ent>(
    edgeType: string,
    id1: Builder<T> | ID,
    nodeType: string,
    orchestrator: Orchestrator<T>, // todo builder?
    options?: AssocEdgeInputOptions,
  ): EdgeOperation<T> {
    let id1Val: ID;
    if (typeof id1 === "string" || typeof id1 === "number") {
      id1Val = id1;
    } else {
      id1Val = id1.placeholderID;
    }
    let id2Val: ID;
    let id2Type: string;

    if (orchestrator.existingEnt) {
      id2Val = orchestrator.existingEnt.id;
      id2Type = orchestrator.existingEnt.nodeType;
    } else {
      // get placeholder.
      id2Val = orchestrator.placeholderID;
      // expected to be filled later
      id2Type = "";
    }
    const edge: AssocEdgeInput = {
      id1: id1Val,
      edgeType: edgeType,
      id2: id2Val,
      id2Type: id2Type,
      id1Type: nodeType,
      ...options,
    };

    return new EdgeOperation(edge);
  }
}
