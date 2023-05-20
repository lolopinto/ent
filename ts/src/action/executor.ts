import Graph from "graph-data-structure";
import { ID, Ent, Viewer, Context, Data } from "../core/base";
import { logQuery } from "../core/ent";
import { Changeset, Executor } from "../action/action";
import { Builder, WriteOperation } from "../action";
import { OrchestratorOptions } from "./orchestrator";
import DB, { Client, Queryer, SyncClient } from "../core/db";
import { log } from "../core/logger";
import {
  ConditionalNodeOperation,
  ConditionalOperation,
  DataOperation,
} from "./operations";

// private to ent
export class ListBasedExecutor<T extends Ent> implements Executor {
  private idx: number = 0;
  public builder?: Builder<Ent> | undefined;
  constructor(
    private viewer: Viewer,
    public placeholderID: ID,
    private operations: DataOperation<T>[],
    private options?: OrchestratorOptions<T, Data, Viewer>,
    private complexOptions?: ComplexExecutorOptions,
  ) {
    this.builder = options?.builder;
  }
  private lastOp: DataOperation<T> | undefined;
  private createdEnt: T | null = null;
  private updatedOps: Map<ID, WriteOperation> = new Map();

  resolveValue(val: ID): Ent | null {
    if (val === this.placeholderID && val !== undefined) {
      return this.createdEnt;
    }

    return null;
  }

  builderOpChanged(builder: Builder<any>): boolean {
    const v = this.updatedOps.get(builder.placeholderID);
    return v !== undefined && v !== builder.operation;
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
    maybeUpdateOperationForOp(this.lastOp, this.updatedOps);

    const done = this.idx === this.operations.length;
    const op = changeOp(this.operations[this.idx], this.complexOptions);

    this.idx++;
    this.lastOp = op;
    // reset since this could be called multiple times. not needed if we have getSortedOps or something like that
    if (done) {
      // TODO need to figure this out
      // this.idx = 0;
    }
    return {
      value: op,
      done: done,
    };
  }

  conditionalBuilderChamged() {
    const conditionalBuilder = this.options?.builder;
    if (conditionalBuilder) {
      // console.debug("conditional builder", conditionalBuilder);
      // console.debug(this.updatedOps);
    }
    return conditionalBuilder && this.builderOpChanged(conditionalBuilder);
    //   return;
    // }
  }

  getConditionalBuilder() {
    return this.complexOptions?.builder;
  }

  getBuilder() {
    return this.options?.builder;
  }

  async executeObservers() {
    const action = this.options?.action;
    if (!this.options || !action || !action.getObservers) {
      return;
    }
    // do this here and it's better everywhere?
    if (this.conditionalBuilderChamged()) {
      // return;
    }
    const builder = this.options.builder;
    await Promise.all(
      action.getObservers().map(async (observer) => {
        try {
          await observer.observe(builder, action.getInput());
        } catch (err) {
          // TODO we eventually want a global observer error handler so that this can be logged or whatever...
          // TODO https://github.com/lolopinto/ent/issues/1429
        }
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

function maybeUpdateOperationForOp<T extends Ent>(
  op: DataOperation<T> | undefined,
  updatedOps: Map<ID, WriteOperation>,
) {
  if (!op || !op.updatedOperation) {
    return;
  }
  const r = op.updatedOperation();
  if (!r || r.builder.operation === r.operation) {
    return;
  }

  updatedOps.set(r.builder.placeholderID, r.operation);
  // console.debug(updatedOps);
}

// TODO rename this?
interface ComplexExecutorOptions {
  conditionalOverride: boolean;
  builder: Builder<any, any>;
}

export class ComplexExecutor<T extends Ent> implements Executor {
  private idx: number = 0;
  private mapper: Map<ID, Ent> = new Map();
  private lastOp: DataOperation<Ent> | undefined;
  private allOperations: DataOperation<Ent>[] = [];
  private executors: Executor[] = [];
  private updatedOps: Map<ID, WriteOperation> = new Map();
  public builder?: Builder<Ent> | undefined;

  constructor(
    private viewer: Viewer,
    public placeholderID: ID,
    operations: DataOperation[],
    dependencies: Map<ID, Builder<T>>,
    changesets: Changeset[],
    options?: OrchestratorOptions<T, Data, Viewer>,
    private complexOptions?: ComplexExecutorOptions,
  ) {
    this.builder = options?.builder;

    let graph = Graph();

    const changesetMap: Map<string, Changeset> = new Map();

    const impl = (c: Changeset) => {
      changesetMap.set(c.placeholderID.toString(), c);

      graph.addNode(c.placeholderID.toString());
      if (c.dependencies) {
        for (let [_, builder] of c.dependencies) {
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
    let localChangesets = new Map<ID, Changeset>();
    changesets.forEach((c) => localChangesets.set(c.placeholderID, c));

    // create a new changeset representing the source changeset with the simple executor
    impl({
      viewer: this.viewer,
      placeholderID: this.placeholderID,
      changesets: changesets,
      dependencies: dependencies,
      executor: () => {
        return new ListBasedExecutor(
          this.viewer,
          this.placeholderID,
          operations,
          options,
        );
      },
    });

    // use a set to handle repeated ops because of how the executor logic currently works
    // TODO: can this logic be rewritten to not have a set yet avoid duplicates?
    let nodeOps: Set<DataOperation<Ent>> = new Set();
    let remainOps: Set<DataOperation<Ent>> = new Set();

    let sorted = graph.topologicalSort(graph.nodes());
    sorted.forEach((node) => {
      let c = changesetMap.get(node);

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
        if (!op) {
          // TODO what is happening...
          // change in behavior in next() leading to needing to do this
          break;
        }
        if (op.createdEnt) {
          nodeOps.add(op);
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
    if (!this.lastOp) {
      return;
    }
    let createdEnt = getCreatedEnt(this.viewer, this.lastOp);
    if (!createdEnt) {
      return;
    }
    const placeholderID = this.lastOp.placeholderID;
    if (!placeholderID) {
      throw new Error(
        `op ${this.lastOp} which implements getCreatedEnt doesn't have a placeholderID`,
      );
    }

    this.mapper.set(placeholderID, createdEnt);
  }

  next(): IteratorResult<DataOperation<Ent>> {
    this.handleCreatedEnt();
    maybeUpdateOperationForOp(this.lastOp, this.updatedOps);

    const done = this.idx === this.allOperations.length;
    const op = changeOp(this.allOperations[this.idx], this.complexOptions);
    this.idx++;

    this.lastOp = op;

    // reset since this could be called multiple times. not needed if we have getSortedOps or something like that
    if (done) {
      // TODO need to figure this out
      // this.idx = 0;
    }

    return { value: op, done };
  }

  resolveValue(val: ID): Ent | null {
    let ent = this.mapper.get(val);
    if (ent) {
      return ent;
    }
    for (const c of this.executors) {
      const ent = c.resolveValue(val);
      if (ent) {
        return ent;
      }
    }
    return null;
  }

  builderOpChanged(builder: Builder<any>): boolean {
    const v = this.updatedOps.get(builder.placeholderID);
    // console.debug(this.updatedOps, builder.placeholderID, v, builder.operation);
    return v !== undefined && v !== builder.operation;
  }

  async executeObservers() {
    await Promise.all(
      this.executors.map((executor) => {
        // console.debug(executor);

        if (executor.builder && this.builderOpChanged(executor.builder)) {
          return null;
        }
        // TODO delete all this logic and fix anything else.
        // the executor.builder check should be enough
        // TODO need this to not only be for ListBasedExecutor...
        if (executor instanceof ListBasedExecutor) {
          const builder = executor.getBuilder();
          const cBuilder = executor.getConditionalBuilder();
          if (builder && this.builderOpChanged(builder)) {
            // console.debug("skipping observer for conditional builder");
            // stopppp
            return null;
          }
          // has to be in complex
          if (cBuilder && this.builderOpChanged(cBuilder)) {
            // console.debug("skipping observer for conditional builder");
            // stopppp
            return null;
          }
        }
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
          if (operation.shortCircuit && operation.shortCircuit(executor)) {
            continue;
          }
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
      logQuery("BEGIN", []);
      await client.query("BEGIN");
      for (const operation of executor) {
        if (operation.shortCircuit && operation.shortCircuit(executor)) {
          continue;
        }

        if (trackOps) {
          operations.push(operation);
        }
        // resolve any placeholders before writes
        if (operation.resolve) {
          operation.resolve(executor);
        }

        await operation.performWrite(client, context);
      }
      logQuery("COMMIT", []);
      await client.query("COMMIT");
    }

    if (executor.postFetch) {
      await executor.postFetch(client, context);
    }
    client.release();
  } catch (e) {
    if (!isSyncClient(client)) {
      // TODO these changes break tests
      logQuery("ROLLBACK", []);
      await client.query("ROLLBACK");
    }
    client.release(e);
    log("error", e);
    throw e;
  }

  if (executor.executeObservers) {
    try {
      await executor.executeObservers();
    } catch (e) {}
  }
  return operations;
}

function changeOp<T extends Ent = Ent>(
  op: DataOperation<T>,
  complexOptions?: ComplexExecutorOptions,
): DataOperation<T> {
  if (
    !op ||
    !complexOptions?.conditionalOverride ||
    op instanceof ConditionalNodeOperation
  ) {
    return op;
  }
  if (op.createdEnt) {
    return new ConditionalNodeOperation(op, complexOptions.builder);
  } else {
    return new ConditionalOperation(op, complexOptions.builder);
  }
}
