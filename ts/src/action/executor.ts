import { ID, Data, Ent, Viewer, EntConstructor, Context } from "../core/base";
import { DataOperation } from "../core/ent";
import { Changeset, Executor } from "../action";
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
    private operations: DataOperation[],
    private options?: OrchestratorOptions<T, Data>,
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
  op: DataOperation | undefined,
  ent: EntConstructor<T>,
): T | null {
  if (op && op.returnedEntRow) {
    let row = op.returnedEntRow();
    if (row) {
      return new ent(viewer, row);
    }
  }
  return null;
}

export class ComplexExecutor<T extends Ent> implements Executor {
  private idx: number = 0;
  private mapper: Map<ID, Ent> = new Map();
  private lastOp: DataOperation | undefined;
  private allOperations: DataOperation[] = [];
  private changesetMap: Map<string, Changeset<Ent>> = new Map();
  private nodeOpMap: Map<DataOperation, Changeset<Ent>> = new Map();
  private executors: Executor[] = [];

  constructor(
    private viewer: Viewer,
    public placeholderID: ID,
    private ent: EntConstructor<T>,
    operations: DataOperation[],
    dependencies: Map<ID, Builder<T>>,
    changesets: Changeset<T>[],
    private options?: OrchestratorOptions<T, Data>,
  ) {
    let graph = Graph();

    const impl = (c: Changeset<Ent>) => {
      this.changesetMap.set(c.placeholderID.toString(), c);

      graph.addNode(c.placeholderID.toString());
      if (c.dependencies) {
        for (let [key, builder] of c.dependencies) {
          // dependency should go first...
          graph.addEdge(
            builder.placeholderID.toString(),
            c.placeholderID.toString(),
            1,
          );
        }
      }

      if (c.changesets) {
        c.changesets.forEach((c2) => {
          impl(c2);
        });
      }
    };

    let localChangesets = new Map<ID, Changeset<Ent>>();
    changesets.forEach((c) => localChangesets.set(c.placeholderID, c));

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
          this.options,
        );
      },
    });

    // use a set to handle repeated ops because of how the executor logic currently works
    // TODO: this logic can be rewritten to be smarter and probably not need a set
    let nodeOps: Set<DataOperation> = new Set();
    let remainOps: Set<DataOperation> = new Set();

    let sorted = graph.topologicalSort(graph.nodes());
    sorted.forEach((node) => {
      let c = this.changesetMap.get(node);

      if (!c) {
        // phew. expect it to be handled somewhere else
        // we can just skip it and expect the resolver to handle this correctly
        // this means it's not a changeset that was created by this ent and can/will be handled elsewhere
        if (dependencies.has(node)) {
          return;
        }
        throw new Error(
          `trying to do a write with incomplete mutation data ${node}. current node: ${placeholderID}`,
        );
      }

      // get ordered list of ops
      let executor = c.executor();
      for (let op of executor) {
        if (op.returnedEntRow) {
          nodeOps.add(op);
          this.nodeOpMap.set(op, c);
        } else {
          remainOps.add(op);
        }
      }

      // only add executors that are part of the changeset to what should be tracked here
      // or self.
      if (
        localChangesets.has(c.placeholderID) ||
        c.placeholderID === placeholderID
      ) {
        this.executors.push(executor);
      }
    });
    // get all the operations and put node operations first
    this.allOperations = [...nodeOps, ...remainOps];
  }

  [Symbol.iterator]() {
    return this;
  }

  private handleCreatedEnt() {
    let c = this.nodeOpMap.get(this.lastOp!);
    if (!c) {
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
