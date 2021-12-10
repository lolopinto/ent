import { ID, Data, Ent, Viewer, EntConstructor, Context } from "../core/base";
import { DataOperation } from "../core/ent";
import { Changeset, Executor } from "../action/action";
import { Builder } from "../action";
import Graph from "graph-data-structure";
import { OrchestratorOptions } from "./orchestrator";
import DB, { Client, Queryer, SyncClient } from "../core/db";
import { log } from "../core/logger";

// private to ent
export class ListBasedExecutor<T extends Ent> implements Executor {
  private idx: number = 0;
  constructor(
    private viewer: Viewer,
    public placeholderID: ID,
    private ent: EntConstructor<T>,
    private operations: DataOperation<T>[],
    private options?: OrchestratorOptions<T, Data>,
  ) {}
  private lastOp: DataOperation<T> | undefined;
  private createdEnt: T | null = null;

  resolveValue(val: ID): Ent | null {
    if (val === this.placeholderID && val !== undefined) {
      return this.createdEnt;
    }
    console.debug("list based", val, this.placeholderID);

    return null;
  }

  [Symbol.iterator]() {
    return this;
  }

  // returns true and null|undefined when done
  next(): IteratorResult<DataOperation<T>> {
    let createdEnt = getCreatedEnt(this.viewer, this.lastOp);
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

  async executeObservers() {
    const action = this.options?.action;
    if (!this.options || !action || !action.observers) {
      return;
    }
    const builder = this.options.builder;
    await Promise.all(
      action.observers.map(async (observer) => {
        await observer.observe(builder, action.getInput());
      }),
    );
  }

  async execute(): Promise<void> {
    await executeOperations(this, this.viewer.context);
  }

  async preFetch?(queryer: Queryer, context: Context): Promise<void> {
    const prefetches: Promise<void>[] = [];

    for (const op of this.operations) {
      if (op.preFetch) {
        prefetches.push(op.preFetch(queryer, context));
      }
    }
    await Promise.all(prefetches);
  }

  async postFetch?(queryer: Queryer, context: Context): Promise<void> {
    const postfetches: Promise<void>[] = [];

    for (const op of this.operations) {
      if (op.postFetch) {
        postfetches.push(op.postFetch(queryer, context));
      }
    }
    await Promise.all(postfetches);
  }
}

function getCreatedEnt<T extends Ent>(
  viewer: Viewer,
  op: DataOperation<T> | undefined,
): T | null {
  if (op && op.createdEnt) {
    return op.createdEnt(viewer);
  }
  return null;
}

export class ComplexExecutor<T extends Ent> implements Executor {
  private idx: number = 0;
  private mapper: Map<ID, Ent> = new Map();
  private lastOp: DataOperation<Ent> | undefined;
  private allOperations: DataOperation<Ent>[] = [];
  private changesetMap: Map<string, Changeset<Ent>> = new Map();
  private nodeOpMap: Map<DataOperation, Changeset<Ent>> = new Map();
  private executors: Executor[] = [];
  private placeholders: ID[] = [];
  private nativeIdx: number = 0;
  private placeholderMap: Map<DataOperation<Ent>, ID> = new Map();

  constructor(
    private viewer: Viewer,
    public placeholderID: ID,
    private ent: EntConstructor<T>,
    operations: DataOperation[],
    // we need node deps vs edge deps...
    entDependencies: Map<ID, Builder<T>>,
    edgeDependencies: Map<ID, Builder<T>>,
    changesets: Changeset<T>[],
    options?: OrchestratorOptions<T, Data>,
  ) {
    const addChangesets = (cs: Changeset<Ent>[], native?: boolean) => {
      for (const c of cs) {
        this.executors.push(c.executor());
        this.placeholders.push(c.placeholderID);
      }
    };
    const addSelf = () => {
      this.nativeIdx = this.executors.length;
      this.executors.push(
        new ListBasedExecutor(viewer, placeholderID, ent, operations, options),
      );
      this.placeholders.push(this.placeholderID);
    };

    // no dependency? just keep track of list of executors and we're done.
    if (entDependencies.size === 0 && edgeDependencies.size === 0) {
      //      console.debug("no dependencies");
      addSelf();
      addChangesets(changesets);
      // console.debug(
      //   "deps complex-simple",
      //   this.nativeIdx,
      //   this.executors,
      //   changesets,
      // );

      //      return;
    } else {
      let earlyChangesets: Changeset<T>[] = [];
      let lateChangesets: Changeset<T>[] = [];
      for (const c of changesets) {
        //      changelistMap.set(c.placeholderID, c);
        // the default expectation is that we run current changeset, then dependent changesets
        // if there are dependencies, we run the changesets that current one depends on before self and then subsequent
        // again, this all assumes simple linear dependencies and no webs for now

        // TODO combine ent and edge dependencies

        // if this changeset depends on that one, run that one first
        // we don't have the info??
        if (
          entDependencies.has(c.placeholderID) ||
          edgeDependencies.has(c.placeholderID)
        ) {
          earlyChangesets.push(c);
          // } else if (
          //   c.edgeDependencies?.has(this.placeholderID) ||
          //   c.entDependencies?.has(this.placeholderID)
          // ) {
          //   earlyChangesets.push(c);
        } else {
          lateChangesets.push(c);
        }
      }

      addChangesets(earlyChangesets);
      addSelf();
      addChangesets(lateChangesets);
    }

    // use a set to handle repeated ops because of how the executor logic currently works
    // TODO: this logic can be rewritten to be smarter and probably not need a set

    let nodeOps: Set<DataOperation<Ent>> = new Set();
    let remainOps: Set<DataOperation<Ent>> = new Set();
    //    let;

    for (let i = 0; i < this.executors.length; i++) {
      const exec = this.executors[i];
      const placeholder = this.placeholders[i];
      for (const op of exec) {
        if (op.createdEnt) {
          nodeOps.add(op);
          // TODO
          this.placeholderMap.set(op, placeholder);
        } else {
          remainOps.add(op);
        }
      }
    }

    this.allOperations = [...nodeOps, ...remainOps];
    //    const changelistMap = new Map<ID, Changeset<T>>();

    //    for (const exec of this.executors)
    //    console.debug("deps", this.nativeIdx, this.executors, changesets);

    // const impl = (c: Changeset<Ent>) => {
    //   this.changesetMap.set(c.placeholderID.toString(), c);

    //   nodeGraph.addNode(c.placeholderID.toString());
    //   // so there's a cycle regardless
    //   // now need to handle this...
    //   if (c.entDependencies) {
    //     for (let [key, builder] of c.entDependencies) {
    //       // dependency should go first...
    //       nodeGraph.addEdge(
    //         builder.placeholderID.toString(),
    //         c.placeholderID.toString(),
    //         1,
    //       );
    //     }
    //   }
    //   if (c.edgeDependencies) {
    //     for (let [key, builder] of c.edgeDependencies) {
    //       // dependency should go first...
    //       edgeGraph.addEdge(
    //         builder.placeholderID.toString(),
    //         c.placeholderID.toString(),
    //         1,
    //       );
    //     }
    //   }

    //   if (c.changesets) {
    //     c.changesets.forEach((c2) => {
    //       impl(c2);
    //     });
    //   }
    // };

    // let localChangesets = new Map<ID, Changeset<Ent>>();
    // changesets.forEach((c) => localChangesets.set(c.placeholderID, c));

    // // create a new changeset representing the source changeset with the simple executor
    // impl({
    //   viewer: this.viewer,
    //   placeholderID: this.placeholderID,
    //   ent: this.ent,
    //   changesets,
    //   entDependencies,
    //   edgeDependencies,
    //   executor: () => {
    //     return new ListBasedExecutor(
    //       this.viewer,
    //       this.placeholderID,
    //       this.ent,
    //       operations,
    //       this.options,
    //     );
    //   },
    // });

    // // use a set to handle repeated ops because of how the executor logic currently works
    // // TODO: this logic can be rewritten to be smarter and probably not need a set
    // let nodeOps: Set<DataOperation> = new Set();
    // let remainOps: Set<DataOperation> = new Set();

    // let sorted = nodeGraph.topologicalSort(nodeGraph.nodes());
    // //    let sorted2 = edgeGraph.topologicalSort(edgeGraph.nodes());

    // // do we even need graph?? just get list and make sure it's added to same changeset?
    // console.debug(edgeGraph.nodes(), sorted);
    // //    console.debug(sorted);
    // //    console.debug(sorted2);
    // sorted.forEach((node) => {
    //   let c = this.changesetMap.get(node);

    //   if (!c) {
    //     // phew. expect it to be handled somewhere else
    //     // we can just skip it and expect the resolver to handle this correctly
    //     // this means it's not a changeset that was created by this ent and can/will be handled elsewhere
    //     if (entDependencies.has(node) || edgeDependencies.has(node)) {
    //       return;
    //     }
    //     throw new Error(
    //       `trying to do a write with incomplete mutation data ${node}. current node: ${placeholderID}`,
    //     );
    //   }

    //   // get ordered list of ops
    //   let executor = c.executor();
    //   for (let op of executor) {
    //     if (op.returnedEntRow) {
    //       nodeOps.add(op);
    //       // we're setting the changeset of Changelog to JobHuntReferral
    //       // but that changeset doesn't know how to load Changelog
    //       // just a JobHuntReferral?
    //       // why does it work in the example here but not in formation code?
    //       // this map of objects is whack...

    //       this.nodeOpMap.set(op, c);
    //     } else {
    //       remainOps.add(op);
    //     }
    //   }

    //   // only add executors that are part of the changeset to what should be tracked here
    //   // or self.
    //   if (
    //     localChangesets.has(c.placeholderID) ||
    //     c.placeholderID === placeholderID
    //   ) {
    //     this.executors.push(executor);
    //   }
    // });
    // // get all the operations and put node operations first
    // this.allOperations = [...nodeOps, ...remainOps];
  }

  [Symbol.iterator]() {
    return this;
  }

  private handleCreatedEnt() {
    if (!this.lastOp) {
      return;
    }
    // when there's multiple levels of nesting, this gets complicated
    // e.g. a depends on b which depends on c
    // so a's index doesn't change while b is doing a whole lot of of stuff
    // so we only care about this when handling things we understand (e.g. we own the placeholder)
    // probably, don't need the mapper anymore?

    //    this.executors[this.idx]
    // let c = this.nodeOpMap.get(this.lastOp!);
    // if (!c) {
    //   // nothing to do here
    //   return;
    // }
    // this is still going to be wrong because wrong ent?
    let createdEnt = getCreatedEnt(this.viewer, this.lastOp);
    console.debug(createdEnt, this.idx, this.nativeIdx);
    if (!createdEnt) {
      return;
    }
    if (this.idx !== this.nativeIdx) {
      //      return;
    }
    const placeholderID = this.placeholderMap.get(this.lastOp);
    if (!placeholderID) {
      return;
    }
    // after every creation, store a mapping from placeholder -> created ent
    // do we need this now that we have this.idx != this.nativeIdx check above?
    //    const placeholderID = this.placeholders[this.idx];

    //    let placeholderID = c.placeholderID;
    this.mapper.set(placeholderID, createdEnt);
  }

  private getOp(): IteratorResult<DataOperation<Ent>> {
    if (this.idx > this.executors.length) {
      return {
        done: true,
        value: undefined,
      };
    }
    let ret = this.executors[this.idx].next();
    return {
      done: false,
      value: ret.value,
    };
  }

  // TODO simple
  next(): IteratorResult<DataOperation<Ent>> {
    this.handleCreatedEnt();
    // let createdEnt = getCreatedEnt(this.viewer, this.lastOp);
    // if (createdEnt) {
    //   this.createdEnt = createdEnt;
    // }

    const done = this.idx === this.allOperations.length;
    const op = this.allOperations[this.idx];
    this.idx++;
    this.lastOp = op;
    return {
      value: op,
      done: done,
    };

    // // true and null
    // // current logic doesn't call handleCreatedEnt for last one so need to rewrite it
    // if (this.lastOp) {
    //   this.handleCreatedEnt();
    // }

    // let ret = this.getOp();
    // // let ret = this.executors[this.idx].next();
    // // let op = ret.value;
    // // let done = false;

    // if (ret.done) {
    //   // if (op) {
    //   //   throw new Error(`executor returned done and returned value ${op}`);
    //   // }
    //   this.idx++;
    //   ret = this.getOp();
    //   // if (this.idx === this.executors.length) {
    //   //   done = true;
    //   // } else {
    //   //   ret = this.executors[this.idx].next();
    //   //   op = ret.value;
    //   //   if (ret.done && op) {
    //   //     throw new Error(`executor returned done and returned value ${op}`);
    //   //   }
    //   // }
    // }
    // this.lastOp = ret.value;
    // // le sigh. isssue is we have an edge node and the node node hasn't been resolved
    // console.debug(ret);
    // return ret;
    // //   done,
    // //   value: op,
    // // };

    // // let ret = this.executors[this.idx].next();
    // // console.debug(ret, this.executors.length, this.idx);
    // // // done with prev executor, let's move to next
    // // if (ret.done) {
    // //   this.idx++;
    // //   //      if (this.idx >= this)
    // //   ret = this.executors[this.idx]?.next();
    // // }
    // // if (!ret) {
    // //   console.debug("set to done");
    // //   ret = { done: true, value: null };
    // // }
    // // this.lastOp = ret.value;

    // return ret;
    // // const done = this.idx === this.allOperations.length;
    // // const op = this.allOperations[this.idx];
    // // this.idx++;
    // // this.lastOp = op;
    // // return {
    // //   value: op,
    // //   done: done,
    // // };
  }

  resolveValue(val: ID): Ent | null {
    let ent = this.mapper.get(val);
    console.debug(this.mapper, val);
    if (ent) {
      return ent;
    }
    for (const c of this.executors) {
      const ent = c.resolveValue(val);
      console.debug(c, c.placeholderID, ent);
      if (ent) {
        return ent;
      }
    }
    return null;
  }

  async executeObservers() {
    await Promise.all(
      this.executors.map((executor) => {
        if (!executor.executeObservers) {
          return null;
        }
        return executor.executeObservers();
      }),
    );
  }

  async execute(): Promise<void> {
    await executeOperations(this, this.viewer.context);
  }

  async preFetch?(queryer: Queryer, context: Context): Promise<void> {
    const prefetches: Promise<void>[] = [];

    for (const exec of this.executors) {
      if (exec.preFetch) {
        prefetches.push(exec.preFetch(queryer, context));
      }
    }
    await Promise.all(prefetches);
  }

  async postFetch?(queryer: Queryer, context: Context): Promise<void> {
    const postfetches: Promise<void>[] = [];

    for (const exec of this.executors) {
      if (exec.postFetch) {
        postfetches.push(exec.postFetch(queryer, context));
      }
    }
    await Promise.all(postfetches);
  }
}

function isSyncClient(client: Client): client is SyncClient {
  return (client as SyncClient).execSync !== undefined;
}

export async function executeOperations(
  executor: Executor,
  context?: Context,
  trackOps?: true,
) {
  const client = await DB.getInstance().getNewClient();

  const operations: DataOperation[] = [];
  try {
    if (executor.preFetch) {
      await executor.preFetch(client, context);
    }

    if (isSyncClient(client)) {
      client.runInTransaction(() => {
        for (const operation of executor) {
          if (trackOps) {
            operations.push(operation);
          }
          if (operation.resolve) {
            operation.resolve(executor);
          }
          operation.performWriteSync(client, context);
        }
      });
    } else {
      await client.query("BEGIN");
      for (const operation of executor) {
        if (trackOps) {
          operations.push(operation);
        }
        // resolve any placeholders before writes
        if (operation.resolve) {
          operation.resolve(executor);
        }

        await operation.performWrite(client, context);
      }
      await client.query("COMMIT");
    }

    if (executor.postFetch) {
      await executor.postFetch(client, context);
    }

    if (executor.executeObservers) {
      await executor.executeObservers();
    }
  } catch (e) {
    if (!isSyncClient(client)) {
      await client.query("ROLLBACK");
    }
    log("error", e);
    throw e;
  } finally {
    client.release();
  }
  return operations;
}
