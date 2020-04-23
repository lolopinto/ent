import { ID, Ent, Viewer, EntConstructor, DataOperation } from "./ent";
import { Changeset, Executor } from "./action";
import { Builder } from "./action";
import Graph from "graph-data-structure";

export class ListBasedExecutor<T extends Ent> implements Executor<T> {
  private idx: number = 0;
  constructor(
    private viewer: Viewer,
    private placeholderID: ID,
    private ent: EntConstructor<T>,
    private operations: DataOperation[],
  ) {}
  private lastOp: DataOperation | undefined;
  private createdEnt: T | null = null;

  resolveValue(val: ID): T | null {
    if (val === this.placeholderID && val !== undefined) {
      return this.createdEnt;
    }

    return null;
  }

  [Symbol.iterator]() {
    return this;
  }

  next(): IteratorResult<DataOperation> {
    let createdEnt = getCreatedEnt(this.viewer, this.lastOp, this.ent);
    if (createdEnt) {
      this.createdEnt = createdEnt;
    }

    const done = this.idx === this.operations.length;
    const op = this.operations[this.idx];
    this.idx++;
    this.lastOp = op;
    return {
      value: op,
      done: done,
    };
  }
}

function getCreatedEnt<T extends Ent>(
  viewer: Viewer,
  op: DataOperation | undefined,
  ent: EntConstructor<T>,
): T | null {
  if (op && op.returnedEntRow) {
    let row = op.returnedEntRow();
    if (row) {
      return new ent(viewer, row["id"], row);
    }
  }
  return null;
}

export class ComplexExecutor<T extends Ent> implements Executor<T> {
  private idx: number = 0;
  private mapper: Map<ID, T> = new Map();
  private lastOp: DataOperation | undefined;
  private allOperations: DataOperation[] = [];
  private changesetNodes: string[] = [];
  private changesetMap: Map<string, Changeset<T>> = new Map();

  constructor(
    private viewer: Viewer,
    private placeholderID: ID,
    private ent: EntConstructor<T>,
    operations: DataOperation[],
    dependencies: Map<ID, Builder<T>>,
    changesets: Changeset<T>[],
  ) {
    let graph = Graph();

    //    let m = new Map<string, Changeset<T>>();
    const impl = (c: Changeset<T>) => {
      this.changesetMap.set(c.placeholderID.toString(), c);

      graph.addNode(c.placeholderID.toString());
      if (c.dependencies) {
        for (let [key, builder] of c.dependencies) {
          graph.addEdge(key.toString(), builder.placeholderID.toString(), 1);
        }
      }

      if (c.changesets) {
        // TODO may not want this because of double-counting and may want each changeset's executor to handle this
        // if so, need to call this outside the loop once
        c.changesets.forEach((c2) => {
          impl(c2);
        });
      }
    };

    // create a new changeset representing the source changeset with the simple executor
    impl({
      viewer: this.viewer,
      placeholderID: this.placeholderID,
      ent: this.ent,
      changesets: changesets,
      dependencies: dependencies,
      executor: () => {
        return new ListBasedExecutor(
          this.viewer,
          this.placeholderID,
          this.ent,
          operations,
        );
      },
    });

    // console.log(graph.nodes());
    // console.log(this.changesetMap);
    //    let rowMap: Map<string, number> = new Map();
    let nodeOps: DataOperation[] = [];
    let remainOps: DataOperation[] = [];

    graph.nodes().forEach((node) => {
      // TODO throw if we see any undefined because we're trying to write with incomplete data
      let c = this.changesetMap.get(node);
      if (!c) {
        throw new Error(
          `trying to do a write with incomplete mutation data ${node}`,
        );
      }
      //      console.log(c);
      // does this work if we're going to call this to figure out the executor?
      // we need to override this for ourselves and instead of doing executor(), it does list like we have in ComplexExecutor...
      for (let op of c.executor()) {
        if (op.returnedEntRow) {
          // keep track of where we are for each node...
          // this should work even if a changeset has multiple of these as long as they're the same node-type
          this.changesetNodes.push(node);
          //          this.rowMap.set(node, nodeOps.length);
          nodeOps.push(op);
        } else {
          remainOps.push(op);
        }
      }
    });
    // get all the operations and put node operations first
    this.allOperations = [...nodeOps, ...remainOps];
    //    console.log(this.changesetNodes);
    //    console.log(nodeOps, remainOps, nodeOps.length, remainOps.length);
    //    console.log(this.allOperations);
  }

  [Symbol.iterator]() {
    return this;
  }

  private handleCreatedEnt() {
    // using previous index
    let c = this.changesetMap.get(this.changesetNodes[this.idx - 1]);
    if (!c) {
      // nothing to do here
      return;
    }
    let createdEnt = getCreatedEnt(this.viewer, this.lastOp, c.ent);
    //    console.log(createdEnt);
    if (!createdEnt) {
      return;
    }

    let placeholderID = c.placeholderID;
    this.mapper.set(placeholderID, createdEnt);
    //    console.log(this.mapper);
  }

  next(): IteratorResult<DataOperation> {
    if (this.lastOp) {
      this.handleCreatedEnt();
    }
    const done = this.idx === this.allOperations.length;
    const op = this.allOperations[this.idx];
    this.idx++;
    this.lastOp = op;
    return {
      value: op,
      done: done,
    };
  }

  resolveValue(val: ID): T | null {
    let ent = this.mapper.get(val);
    if (ent) {
      return ent;
    }
    return null;
  }
}
