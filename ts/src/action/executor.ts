import { ID, Data, Ent, Viewer, Context } from "../core/base";
import { DataOperation } from "../core/ent";
import { Changeset, Executor } from "../action/action";
import { Builder } from "../action";
import { OrchestratorOptions } from "./orchestrator";
import DB, { Client, Queryer, SyncClient } from "../core/db";
import { log } from "../core/logger";

// private to ent
export class ListBasedExecutor<T extends Ent> implements Executor {
  private idx: number = 0;
  constructor(
    private viewer: Viewer,
    public placeholderID: ID,
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
  private executors: Executor[] = [];
  private placeholders: ID[] = [];
  private nativeIdx: number = 0;
  private placeholderMap: Map<DataOperation<Ent>, ID> = new Map();

  constructor(
    private viewer: Viewer,
    public placeholderID: ID,
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
        new ListBasedExecutor(viewer, placeholderID, operations, options),
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
  }

  [Symbol.iterator]() {
    return this;
  }

  private handleCreatedEnt() {
    if (!this.lastOp) {
      return;
    }
    let createdEnt = getCreatedEnt(this.viewer, this.lastOp);
    console.debug(createdEnt, this.idx, this.nativeIdx);
    if (!createdEnt) {
      return;
    }
    const placeholderID = this.placeholderMap.get(this.lastOp);
    if (!placeholderID) {
      console.error(`couldn't find placeholderID for op ${this.lastOp}`);
      return;
    }

    this.mapper.set(placeholderID, createdEnt);
  }

  next(): IteratorResult<DataOperation<Ent>> {
    this.handleCreatedEnt();

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
