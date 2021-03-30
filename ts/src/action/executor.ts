import { ID, Ent, Viewer, EntConstructor, DataOperation } from "../core/ent";
import { Changeset, Executor } from "../action";
import { Builder } from "../action";
import Graph from "graph-data-structure";
import { OrchestratorOptions } from "./orchestrator";

// interface executorOptions<T extends Ent> extends OrchestratorOptions<T> {
//   disableObservers?: boolean;
// }
// private to ent
export class ListBasedExecutor<T extends Ent> implements Executor<T> {
  private idx: number = 0;
  constructor(
    private viewer: Viewer,
    public placeholderID: ID,
    private ent: EntConstructor<T>,
    private operations: DataOperation[],
    private options?: OrchestratorOptions<T>,
  ) {}
  private lastOp: DataOperation | undefined;
  private createdEnt: T | null = null;

  resolveValue(val: ID): Ent | null {
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

  //  private executed: boolean;
  async executeObservers() {
    // if (this.options?.disableObservers) {
    //   //      return;
    // }
    // if (this.executed) {
    //   //      return;
    // }
    const action = this.options?.action;
    if (!this.options || !action || !action.observers) {
      return;
    }
    const builder = this.options.builder;
    await Promise.all(
      action.observers.map((observer) => {
        observer.observe(builder, action.getInput());
      }),
    );
    //    this.executed = true;
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
  private mapper: Map<ID, Ent> = new Map();
  private lastOp: DataOperation | undefined;
  private allOperations: DataOperation[] = [];
  private changesetMap: Map<string, Changeset<Ent>> = new Map();
  private nodeOpMap: Map<DataOperation, Changeset<Ent>> = new Map();
  private executors: Executor<Ent>[] = [];

  constructor(
    private viewer: Viewer,
    public placeholderID: ID,
    private ent: EntConstructor<T>,
    operations: DataOperation[],
    dependencies: Map<ID, Builder<T>>,
    changesets: Changeset<T>[],
    private options?: OrchestratorOptions<T>,
  ) {
    //    console.log("sss", placeholderID, operations, dependencies, changesets);
    let graph = Graph();

    const impl = (c: Changeset<Ent>) => {
      this.changesetMap.set(c.placeholderID.toString(), c);

      graph.addNode(c.placeholderID.toString());
      if (c.dependencies) {
        for (let [key, builder] of c.dependencies) {
          // graph goes from changeset -> dependencies so?
          graph.addEdge(
            c.placeholderID.toString(),
            builder.placeholderID.toString(),
            1,
          );
        }
      }

      if (c.changesets) {
        // TODO may not want this because of double-counting and may want each changeset's executor to handle this
        // if so, need to call this outside the loop once
        c.changesets.forEach((c2) => {
          impl(c2);

          //          c2.executor();
          //          for (op)
        });
      }
    };

    let ourChangesets = new Map<ID, Changeset<Ent>>();
    changesets.forEach((c) => ourChangesets.set(c.placeholderID, c));
    // create a new changeset representing the source changeset with the simple executor
    // this is probably what's causing the observer issue
    // graph.addNode(placeholderID.toString());
    // //    this.changesetMap.set(placeholderID.toString(), this);

    // for (let [key, builder] of dependencies) {
    //   graph.addEdge(
    //     placeholderID.toString(),
    //     builder.placeholderID.toString(),
    //     1,
    //   );
    // }

    //    changesets.forEach((c) => impl(c));

    // let opts: executorOptions<T> | undefined;
    // if (this.options) {
    //   opts = {
    //     disableObservers: true,
    //     ...this.options,
    //   };
    // }
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
          this.options,
        );
      },
    });

    // use a set to handle repeated ops because of how the executor logic currently works
    // TODO: this logic can be rewritten to be smarter and probably not need a set
    let nodeOps: Set<DataOperation> = new Set();
    let remainOps: Set<DataOperation> = new Set();
    let seenExec: Map<ID, Executor<Ent>> = new Map();

    //    console.log(graph.nodes());
    graph.nodes().forEach((node) => {
      // TODO throw if we see any undefined because we're trying to write with incomplete data
      let c = this.changesetMap.get(node);
      if (!c) {
        // hmm this doesn't break anything... we should just confirm that this works and have a nicetohave to fix this
        // this isn't even the issue for this case.
        // so the issue I found in ent-rsvp is different...
        //        console.log("non-existent", node);
        // this case is different...
        //        return;
        throw new Error(
          `trying to do a write with incomplete mutation data ${node}`,
        );
      }

      // does this work if we're going to call this to figure out the executor?
      // we need to override this for ourselves and instead of doing executor(), it does list like we have in ComplexExecutor...
      let executor = c.executor();
      if (seenExec.get(executor.placeholderID)) {
        //        console.log("seenExec", executor);
        return;
      }
      seenExec.set(executor.placeholderID, executor);
      for (let op of executor) {
        if (op.returnedEntRow) {
          nodeOps.add(op);
          this.nodeOpMap.set(op, c);
        } else {
          remainOps.add(op);
        }
      }

      // only add executors that are part of the changeset to what should be executed directly here
      // or self.
      if (
        ourChangesets.has(c.placeholderID) ||
        c.placeholderID === placeholderID
      ) {
        this.executors.push(executor);
      }
    });
    //    console.log(this.executors.length);
    // get all the operations and put node operations first
    this.allOperations = [...nodeOps, ...remainOps];
    //    console.log(util.inspect(this.allOperations, true, 3));
  }

  [Symbol.iterator]() {
    return this;
  }

  private handleCreatedEnt() {
    let c = this.nodeOpMap.get(this.lastOp!);
    //    console.log(this.lastOp, c);
    if (!c) {
      //      console.log("no changeset", this.lastOp);
      // nothing to do here
      return;
    }
    let createdEnt = getCreatedEnt(this.viewer, this.lastOp, c.ent);
    if (!createdEnt) {
      return;
    }

    let placeholderID = c.placeholderID;
    this.mapper.set(placeholderID, createdEnt);
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

  resolveValue(val: ID): Ent | null {
    let ent = this.mapper.get(val);
    if (ent) {
      return ent;
    }
    //    console.log(this.mapper);
    return null;
  }

  //  private executed: boolean;
  async executeObservers() {
    // if (this.executed) {
    //   return;
    // }
    //    console.log(this.executors);
    await Promise.all(
      this.executors.map((executor) => {
        if (!executor.executeObservers) {
          return null;
        }
        return executor.executeObservers();
      }),
    );
    //    this.executed = true;
  }
}
