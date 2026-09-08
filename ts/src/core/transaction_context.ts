import { AsyncLocalStorage } from "async_hooks";
import type { Context, Data, Ent, Viewer } from "./base";
import type { Builder, Executor } from "../action/action";
import type { assocEdgeLoader } from "./ent";
import type { Queryer } from "./db";

type TransactionBuilderIdentity = Pick<Builder<Ent>, "placeholderID">;

const transactionTokenBrand = Symbol("transaction token");

export interface TransactionToken {
  readonly [transactionTokenBrand]: true;
}

export function createTransactionToken(): TransactionToken {
  return { [transactionTokenBrand]: true };
}

// Internal state only. Never replace DB.instance or a viewer's request context.
export interface TransactionState {
  token: TransactionToken;
  isolationLevel: "serializable" | "read committed";
  attempt: number;
  queryer: Queryer;
  readQueryer: Pick<Queryer, "query" | "queryAll">;
  active: boolean;
  failed: boolean;
  error?: unknown;
  pending: Set<Promise<unknown>>;
  caches: Map<NonNullable<Context["cache"]>, NonNullable<Context["cache"]>>;
  edgeMetadataLoader?: typeof assocEdgeLoader;
  observers: (() => Promise<void>)[];
  receipts: (() => void)[];
  guardedRoot?: TransactionBuilderIdentity;
  generation: number;
  branchClaims: PreparationNode[];
}

interface PreparationNode {
  builder: TransactionBuilderIdentity;
  root: TransactionBuilderIdentity;
  token: TransactionToken;
  resources?: readonly string[];
  resourcesPending?: boolean;
  validation?: { active: boolean };
  pending?: Set<Promise<unknown>>;
}

interface EntTransaction {
  readonly token: TransactionToken;
  readonly generation: number;
}

const preparationStorage = new AsyncLocalStorage<PreparationNode>();
const executorBuilders = new WeakMap<
  Executor,
  readonly TransactionBuilderIdentity[]
>();
const executorReads = new WeakMap<Executor, TransactionReadState | undefined>();
const resultTransactions = new WeakMap<
  TransactionBuilderIdentity,
  EntTransaction
>();

export function assertIndependentActionSave() {
  const state = getTransactionState();
  if (state && preparationStorage.getStore()?.token === state.token) {
    throw new Error(
      "return child changesets from triggers; nested action saves during transaction preparation are not supported",
    );
  }
}

export function runInActionPreparation<T>(
  builder: TransactionBuilderIdentity,
  prepare: () => Promise<T>,
  validationOnly = false,
): Promise<T> {
  const state = getTransactionState();
  if (!state) {
    return prepare();
  }
  const parent = preparationStorage.getStore();
  const scopedParent = parent?.token === state.token ? parent : undefined;
  const root = scopedParent?.root ?? builder;
  const validation =
    scopedParent?.validation ?? (validationOnly ? { active: true } : undefined);
  const node: PreparationNode = {
    builder,
    root,
    token: state.token,
    validation,
    pending: validation ? new Set() : undefined,
  };
  const prepared = preparationStorage.run(node, async () => {
    try {
      return await prepare();
    } finally {
      // If a trigger's Promise.all rejects, other children can still be
      // running. Wait for descendants before restoring this participant or
      // completing root validation. Exclude the owner from its
      // own set of pending work.
      if (node.pending) {
        do {
          await Promise.allSettled([...node.pending]);
          // A completed SQL or loader promise can resume several async wrappers
          // before the caller starts child preparation. Wait one event loop
          // turn for those wrappers to register reads
          // and children before checking again.
          await new Promise<void>((resolve) => setImmediate(resolve));
        } while (node.pending.size);
      }
      if (validation && validation !== scopedParent?.validation) {
        validation.active = false;
        state.branchClaims = state.branchClaims.filter(
          (claim) => claim.validation !== validation,
        );
        state.guardedRoot = state.branchClaims[0]?.root;
      }
    }
  });
  if (scopedParent?.pending) {
    scopedParent.pending.add(prepared);
    void prepared.then(
      () => scopedParent.pending!.delete(prepared),
      () => scopedParent.pending!.delete(prepared),
    );
  }
  return prepared;
}

export function trackValidationRead<T>(read: Promise<T>): Promise<T> {
  const node = preparationStorage.getStore();
  // Once a read returns a promise, tracking must not throw and leave that
  // promise unhandled. The read itself reports errors if its scope has closed.
  const state = transactionStorage.getStore();
  if (
    state?.active &&
    node?.token === state.token &&
    node.validation?.active &&
    node.pending
  ) {
    node.pending.add(read);
    void read.then(
      () => node.pending!.delete(read),
      () => node.pending!.delete(read),
    );
  }
  return read;
}

export function isPreparingAction(
  builder: TransactionBuilderIdentity,
): boolean {
  const state = getTransactionState();
  const node = preparationStorage.getStore();
  return !!state && node?.token === state.token && node.builder === builder;
}

export function isValidationPreparation(): boolean {
  const state = getTransactionState();
  const node = preparationStorage.getStore();
  return !!state && node?.token === state.token && !!node.validation;
}

// Wait for parallel work started by the framework and registered child actions.
// Preserve the first Promise.all rejection, regardless of the array order.
export async function awaitActionPreparations<T>(
  work: Iterable<T | PromiseLike<T>>,
): Promise<Awaited<T>[]> {
  if (!isValidationPreparation()) {
    return Promise.all(work);
  }
  let failed = false;
  let failure: unknown;
  const results = await Promise.all(
    Array.from(work, (pending) =>
      Promise.resolve(pending).catch((error) => {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }),
    ),
  );
  if (failed) {
    throw failure;
  }
  return results as Awaited<T>[];
}

function getGuardedPreparation() {
  const state = getTransactionState();
  const node = preparationStorage.getStore();
  if (!state || !node || node.token !== state.token) {
    throw new Error("guarded actions require withTransaction");
  }
  if (state.guardedRoot && state.guardedRoot !== node.root) {
    throw new Error(
      "guarded root actions must be prepared and saved sequentially; await each save and reload before preparing the next action",
    );
  }
  return { state, node };
}

export function reserveGuardedPreparation(): TransactionReadState {
  const { state, node } = getGuardedPreparation();
  // Reserve the root before user code can await. Keep the pending claim through
  // nested validation cleanup, then check its resource keys when they resolve.
  node.resourcesPending = true;
  if (!state.branchClaims.includes(node)) {
    state.branchClaims.push(node);
  }
  state.guardedRoot = node.root;
  return { transaction: state, generation: state.generation };
}

export function claimGuardedPreparation(resources?: readonly string[]) {
  const { state, node } = getGuardedPreparation();
  if (
    resources !== undefined &&
    (!Array.isArray(resources) ||
      !resources.length ||
      resources.some((key) => typeof key !== "string" || !key.length))
  ) {
    throw new Error(
      "getTransactionResources must return a non-empty array of non-empty strings",
    );
  }
  for (const owner of state.branchClaims) {
    // The same action can validate while being built. Different actions must
    // prove independence even when one was created by the other's trigger.
    // A pending hook checks resolved claims when it finishes, so independent
    // siblings can resolve their keys concurrently.
    if (owner.builder === node.builder || owner.resourcesPending) {
      continue;
    }
    if (
      !owner.resources ||
      !resources ||
      resources.some((key) => owner.resources!.includes(key))
    ) {
      throw new Error(
        "overlapping guarded action preparation branches; consolidate dependent child changesets or declare independent child transaction resources",
      );
    }
  }
  node.resources = resources && [...resources];
  node.resourcesPending = false;
  if (!state.branchClaims.includes(node)) {
    state.branchClaims.push(node);
  }
  state.guardedRoot = node.root;
}

export function setExecutorBuilders(
  executor: Executor,
  builders: readonly TransactionBuilderIdentity[],
) {
  executorBuilders.set(executor, builders);
  executorReads.set(executor, getTransactionReadState());
}

export function assertExecutorTransaction(executor: Executor) {
  if (executorReads.has(executor)) {
    assertTransactionRead(executorReads.get(executor));
  }
}

export function getExecutorBuilders(
  executor: Executor,
): readonly TransactionBuilderIdentity[] {
  return executorBuilders.get(executor) ?? [];
}

export function completeGuardedPreparation(
  state: TransactionState,
  executor: Executor,
) {
  const builders = getExecutorBuilders(executor);
  if (state.guardedRoot && builders.includes(state.guardedRoot)) {
    state.guardedRoot = undefined;
    state.branchClaims.length = 0;
    state.generation++;
    state.edgeMetadataLoader = undefined;
    for (const cache of state.caches.values()) {
      cache.clearCache();
    }
  }
  // A result getter reconstructs a snapshot without reading the database again.
  // Record the completed write's transaction and generation for every builder.
  const provenance = { token: state.token, generation: state.generation };
  for (const builder of builders) {
    resultTransactions.set(builder, provenance);
  }
}

export const transactionStorage = new AsyncLocalStorage<TransactionState>();
const entTransactions = new WeakMap<Ent, EntTransaction>();
const rowTransactions = new WeakMap<Data, EntTransaction>();

export function recordPreparedEntTransaction(
  ent: Ent,
  read: TransactionReadState | undefined,
) {
  if (read) {
    entTransactions.set(ent, {
      token: read.transaction.token,
      generation: read.generation,
    });
  } else {
    entTransactions.delete(ent);
  }
}

export function recordActionResultTransaction<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(ent: TEnt, builder: Builder<TEnt, TViewer>) {
  const provenance = resultTransactions.get(builder);
  if (provenance) {
    entTransactions.set(ent, provenance);
  } else {
    // An unscoped result must not inherit the scope used to inspect it later.
    entTransactions.delete(ent);
  }
}

export function hasActionResultTransaction(
  builder: TransactionBuilderIdentity,
): boolean {
  return resultTransactions.has(builder);
}

export function recordEntTransaction(ent: Ent, row: Data) {
  // Copy only the row's recorded transaction and generation. Unknown data must
  // not inherit the current scope.
  const provenance = rowTransactions.get(row);
  if (provenance) {
    entTransactions.set(ent, provenance);
  } else {
    entTransactions.delete(ent);
  }
}

export interface TransactionReadState {
  readonly transaction: TransactionState;
  readonly generation: number;
}

export function getTransactionReadState(): TransactionReadState | undefined {
  const transaction = getTransactionState();
  return transaction && { transaction, generation: transaction.generation };
}

export function assertTransactionRead(read: TransactionReadState | undefined) {
  assertLoaderTransaction(read?.transaction);
  if (read && read.generation !== read.transaction.generation) {
    const error = new Error(
      "recreate queries and loaders after each guarded save; a read cannot cross transaction generations",
    );
    failTransaction(read.transaction, error);
    throw error;
  }
}

export async function runTransactionRead<T>(
  read: TransactionReadState | undefined,
  load: () => Promise<T>,
): Promise<T> {
  return trackValidationRead(
    (async () => {
      assertTransactionRead(read);
      const result = await load();
      assertTransactionRead(read);
      return result;
    })(),
  );
}

export function recordRowTransaction(
  row: Data,
  read: TransactionReadState | undefined,
) {
  if (read) {
    rowTransactions.set(row, {
      token: read.transaction.token,
      generation: read.generation,
    });
  } else {
    rowTransactions.delete(row);
  }
}

export function copyEntTransaction(source: Ent, target: Ent) {
  // Privacy checks can replace an Ent after an await. Preserve the original
  // transaction and generation, even if absent. Don't use the current scope.
  const provenance = entTransactions.get(source);
  if (provenance) {
    entTransactions.set(target, provenance);
  } else {
    entTransactions.delete(target);
  }
}

export function assertEntTransaction(ent: Ent) {
  const state = getTransactionState();
  const loaded = entTransactions.get(ent);
  if (
    state &&
    (loaded?.token !== state.token || loaded?.generation !== state.generation)
  ) {
    const error = new Error(
      "reload existingEnt inside the withTransaction callback on every attempt",
    );
    failTransaction(state, error);
    throw error;
  }
}

export function getTransactionState(): TransactionState | undefined {
  const state = transactionStorage.getStore();
  if (state && !state.active) {
    throw new Error(
      "transaction scope is closed; await all work inside withTransaction",
    );
  }
  const preparation = preparationStorage.getStore();
  if (
    state &&
    preparation?.token === state.token &&
    preparation.validation?.active === false
  ) {
    throw new Error(
      "action validation scope is closed; await all validation work",
    );
  }
  return state;
}

export function failTransaction(state: TransactionState, error: unknown) {
  if (!state.failed) {
    state.failed = true;
    state.error = error;
  }
}

// Save entry points include preparation, executor assembly, and execution
// setup. An error in any of these stages must abort the owning scope, even if a
// caller catches it before the withTransaction callback returns.
export async function runActionExecution<T>(
  execute: () => Promise<T>,
): Promise<T> {
  const state = getTransactionState();
  try {
    return await execute();
  } catch (error) {
    if (state) {
      failTransaction(state, error);
    }
    throw error;
  }
}

// Let public validation classify a child's errors. Correctable validation
// errors remain recoverable; SQL and composition errors still fail the scope.
export function runActionChangeset<T>(prepare: () => Promise<T>): Promise<T> {
  return isValidationPreparation() ? prepare() : runActionExecution(prepare);
}

// Captured loaders must not carry cached rows or pending batches across scopes.
export function assertLoaderTransaction(owner: TransactionState | undefined) {
  if (getTransactionState() !== owner) {
    throw new Error(
      "create loaders and queries inside the withTransaction callback; loaders cannot cross transaction scopes",
    );
  }
}
