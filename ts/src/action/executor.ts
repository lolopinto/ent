import { ID, Ent, Viewer, Context, Data } from "../core/base";
import { logQuery } from "../core/ent";
import { Changeset, Executor } from "../action/action";
import { Builder, WriteOperation } from "../action";
import { OrchestratorOptions } from "./orchestrator";
import DB, { Client, Queryer, SyncClient } from "../core/db";
import { log } from "../core/logger";
import {
  assertTransactionRead,
  assertExecutorTransaction,
  getTransactionReadState,
  failTransaction,
  getTransactionState,
  getExecutorBuilders,
  setExecutorBuilders,
  completeActionPreparation,
  getExecutorScopeValidators,
  setExecutorScopeValidators,
  assertIndependentActionSave,
  runActionExecution,
} from "../core/transaction_context";
import { TopologicalGraph } from "./topological_sort";
import {
  ConditionalNodeOperation,
  ConditionalOperation,
  DataOperation,
} from "./operations";

// private to ent
export class ListBasedExecutor<T extends Ent> implements Executor {
  private transactionRead = getTransactionReadState();
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
    setExecutorBuilders(this, this.builder ? [this.builder] : []);
    const action = options?.action;
    if (options && action?.validateBeforeCommit) {
      setExecutorScopeValidators(this, [
        {
          builder: options.builder,
          validate: (context) => action.validateBeforeCommit!(context),
        },
      ]);
    }
  }
  private lastOp: DataOperation<T> | undefined;
  private createdEnt: T | null = null;
  private changedOps: Map<ID, WriteOperation> = new Map();

  resolveValue(val: ID): Ent | null {
    if (val === this.placeholderID && val !== undefined) {
      return this.createdEnt;
    }

    return null;
  }

  builderOpChanged(builder: Builder<any>): boolean {
    const v = this.changedOps.get(builder.placeholderID);
    return v !== undefined && v !== builder.operation;
  }

  [Symbol.iterator]() {
    return this;
  }

  // returns true and null|undefined when done
  next(): IteratorResult<DataOperation<T>> {
    assertTransactionRead(this.transactionRead);
    let createdEnt = getCreatedEnt(this.viewer, this.lastOp);
    if (createdEnt) {
      this.createdEnt = createdEnt;
    }
    maybeFlagOpOperationAsChanged(this.lastOp, this.changedOps);

    const done = this.idx >= this.operations.length;
    const op = maybeChangeOp(this.operations[this.idx], this.complexOptions);

    this.idx++;
    this.lastOp = op;

    if (done || op === undefined) {
      return {
        value: op,
        done: true,
      };
    }
    return {
      value: op,
    };
  }

  async executeObservers() {
    const action = this.options?.action;
    if (!this.options || !action || !action.getObservers) {
      return;
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
    await runActionExecution(() =>
      executeOperations(this, this.viewer.context),
    );
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

function maybeFlagOpOperationAsChanged<T extends Ent>(
  op: DataOperation<T> | undefined,
  changedOps: Map<ID, WriteOperation>,
) {
  if (!op || !op.updatedOperation) {
    return;
  }
  const r = op.updatedOperation();
  if (!r || r.builder.operation === r.operation) {
    return;
  }

  changedOps.set(r.builder.placeholderID, r.operation);
}

interface ComplexExecutorOptions {
  conditionalOverride: boolean;
  builder: Builder<any, any>;
}

export class ComplexExecutor<T extends Ent> implements Executor {
  private transaction = getTransactionState();
  private transactionRead = getTransactionReadState();
  private idx: number = 0;
  private mapper: Map<ID, Ent> = new Map();
  private lastOp: DataOperation<Ent> | undefined;
  private allOperations: DataOperation<Ent>[] = [];
  private executors: Executor[] = [];
  private changedOps: Map<ID, WriteOperation> = new Map();
  public builder?: Builder<Ent> | undefined;

  constructor(
    private viewer: Viewer,
    public placeholderID: ID,
    operations: DataOperation<T>[],
    dependencies: Map<ID, Builder<T>>,
    changesets: Changeset[],
    options?: OrchestratorOptions<T, Data, Viewer>,
    private complexOptions?: ComplexExecutorOptions,
  ) {
    try {
      this.builder = options?.builder;

      const graph = new TopologicalGraph();

      const changesetMap: Map<string, Changeset> = new Map();

      const impl = (c: Changeset) => {
        changesetMap.set(c.placeholderID.toString(), c);

        graph.addNode(c.placeholderID.toString());
        if (c.dependencies) {
          for (let [_, builder] of c.dependencies) {
            // Execute dependencies before the changeset that uses them.
            graph.addEdge(
              builder.placeholderID.toString(),
              c.placeholderID.toString(),
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

      // Represent the root operations as a changeset with a list executor.
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

      // Deduplicate operations that appear in more than one executor.
      let nodeOps: Set<DataOperation<Ent>> = new Set();
      let remainOps: Set<DataOperation<Ent>> = new Set();

      const sorted = graph.topologicalSort();
      sorted.forEach((node) => {
        let c = changesetMap.get(node);

        if (!c) {
          // Leave dependencies outside this changeset graph to the resolver.
          if (dependencies.has(node)) {
            return;
          }
          throw new Error(
            `trying to do a write with incomplete mutation data ${node}. current node: ${placeholderID}`,
          );
        }

        // Read operations in dependency order.
        let executor = c.executor();
        for (let op of executor) {
          if (op.createdEnt) {
            nodeOps.add(op);
          } else {
            remainOps.add(op);
          }
        }

        // Track the root executor and executors for its direct child changesets.
        if (
          localChangesets.has(c.placeholderID) ||
          c.placeholderID === placeholderID
        ) {
          this.executors.push(executor);
        }
      });
      // Run node operations before the remaining operations.
      this.allOperations = [...nodeOps, ...remainOps];
      setExecutorBuilders(
        this,
        this.executors.flatMap((executor) => [
          ...getExecutorBuilders(executor),
        ]),
      );
      setExecutorScopeValidators(
        this,
        this.executors.flatMap((executor) => [
          ...getExecutorScopeValidators(executor),
        ]),
      );
    } catch (error) {
      if (this.transaction) {
        failTransaction(this.transaction, error);
      }
      throw error;
    }
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
    assertTransactionRead(this.transactionRead);
    this.handleCreatedEnt();
    maybeFlagOpOperationAsChanged(this.lastOp, this.changedOps);

    const done = this.idx >= this.allOperations.length;
    const op = maybeChangeOp(this.allOperations[this.idx], this.complexOptions);
    this.idx++;

    this.lastOp = op;

    if (done || op === undefined) {
      return {
        value: op,
        done: true,
      };
    }

    return { value: op };
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
    const v = this.changedOps.get(builder.placeholderID);
    return v !== undefined && v !== builder.operation;
  }

  async executeObservers() {
    await Promise.all(
      this.executors.map((executor) => {
        if (executor.builder && this.builderOpChanged(executor.builder)) {
          return null;
        }
        if (!executor.executeObservers) {
          return null;
        }
        return executor.executeObservers();
      }),
    );
  }

  async execute(): Promise<void> {
    await runActionExecution(() =>
      executeOperations(this, this.viewer.context),
    );
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
  const transaction = getTransactionState();
  if (transaction) {
    const operations: DataOperation<Ent>[] = [];
    const writeTargets = new Map<string, Builder<Ent>>();
    const executedBuilders = new Set<Builder<Ent>>();
    try {
      assertExecutorTransaction(executor);
      assertIndependentActionSave();
      if (
        transaction.preparingRoot &&
        !getExecutorBuilders(executor).includes(transaction.preparingRoot)
      ) {
        throw new Error(
          "execute the complete prepared root action before starting another save",
        );
      }
      if (executor.preFetch) {
        await executor.preFetch(transaction.queryer, context);
      }
      for (const operation of executor) {
        if (operation.shortCircuit?.(executor)) {
          continue;
        }
        if (trackOps) {
          operations.push(operation);
        }
        operation.resolve?.(executor);
        const target = operation.transactionWriteTarget?.();
        if (target) {
          const key = JSON.stringify(target);
          const previous = writeTargets.get(key);
          if (previous && previous !== operation.builder) {
            throw new Error(
              "scoped changesets cannot mutate the same Ent through multiple builders; consolidate dependent writes into one action",
            );
          }
          writeTargets.set(key, operation.builder);
        }
        await operation.performWrite(transaction.queryer, context);
        if (!operation.skipScopeValidation) {
          executedBuilders.add(operation.builder);
        }
      }
      // Load results before commit so a failure can roll back the owning scope.
      await executor.postFetch?.(transaction.queryer, context);
      completeActionPreparation(transaction, executor);
      for (const { builder, validate } of getExecutorScopeValidators(
        executor,
      )) {
        if (executedBuilders.has(builder as Builder<Ent>)) {
          transaction.validators.set(builder, validate);
        }
      }
      transaction.receipts.push(() => {
        (
          executor as Executor & { transactionCommitted?(): void }
        ).transactionCommitted?.();
      });
      if (executor.executeObservers) {
        transaction.observers.push(() => executor.executeObservers!());
      }
      return operations;
    } catch (error) {
      failTransaction(transaction, error);
      throw error;
    }
  }
  assertExecutorTransaction(executor);
  const client = await DB.getInstance().getNewClient();

  const operations: DataOperation<Ent>[] = [];
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

function maybeChangeOp<T extends Ent = Ent>(
  op: DataOperation<T> | undefined,
  complexOptions?: ComplexExecutorOptions,
): DataOperation<T> | undefined {
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
