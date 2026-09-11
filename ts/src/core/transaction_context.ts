import { AsyncLocalStorage } from "async_hooks";
import type { Context, Data, Ent, Viewer } from "./base";
import type { Builder, Executor } from "../action/action";
import type { assocEdgeLoader } from "./ent";
import type { Queryer } from "./db";
import type { ScopeValidationContext } from "./transaction";

type TransactionBuilderIdentity = Pick<Builder<Ent>, "placeholderID">;

const transactionTokenBrand = Symbol("transaction token");

export interface TransactionToken {
  readonly [transactionTokenBrand]: true;
}

export function createTransactionToken(): TransactionToken {
  return { [transactionTokenBrand]: true };
}

// Keep transaction state separate from DB.instance and viewer request contexts.
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
  preparingRoot?: TransactionBuilderIdentity;
  preparingValidation?: { active: boolean };
  generation: number;
  validating: boolean;
  pendingActions: Set<Promise<unknown>>;
  pendingPreparations: Set<Promise<unknown>>;
  validators: Map<TransactionBuilderIdentity, ScopeValidator>;
}

export type ScopeValidator = (
  context: ScopeValidationContext,
) => void | Promise<void>;

interface ActionScopeValidator {
  builder: TransactionBuilderIdentity;
  validate: ScopeValidator;
}

interface FinalValidation {
  transaction: TransactionState;
  active: boolean;
  pending: Set<Promise<unknown>>;
}

const finalValidationStorage = new AsyncLocalStorage<FinalValidation>();

interface PreparationNode {
  builder: TransactionBuilderIdentity;
  root: TransactionBuilderIdentity;
  token: TransactionToken;
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
const executorValidators = new WeakMap<
  Executor,
  readonly ActionScopeValidator[]
>();
const resultTransactions = new WeakMap<
  TransactionBuilderIdentity,
  EntTransaction
>();

export function assertIndependentActionSave() {
  const state = getTransactionState();
  assertActionPreparationAllowed();
  if (state && preparationStorage.getStore()?.token === state.token) {
    throw new Error(
      "return child changesets from triggers; nested action saves during transaction preparation are not supported",
    );
  }
}

export function assertActionPreparationAllowed() {
  const state = getTransactionState();
  if (state?.validating) {
    const error = new Error(
      "actions cannot prepare or save during scope validation",
    );
    failTransaction(state, error);
    throw error;
  }
}

export function isFinalScopeValidation(): boolean {
  return getTransactionState()?.validating === true;
}

export async function runFinalScopeValidation<T>(
  transaction: TransactionState,
  validate: () => Promise<T>,
): Promise<T> {
  const validation: FinalValidation = {
    transaction,
    active: true,
    pending: new Set(),
  };
  return finalValidationStorage.run(validation, async () => {
    try {
      return await validate();
    } catch (error) {
      failTransaction(transaction, error);
      throw error;
    } finally {
      validation.active = false;
      if (validation.pending.size) {
        failTransaction(
          transaction,
          new Error("await all reads during scope validation"),
        );
        await Promise.allSettled([...validation.pending]);
      }
    }
  });
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
  assertActionPreparationAllowed();
  const parent = preparationStorage.getStore();
  const scopedParent = parent?.token === state.token ? parent : undefined;
  const root = scopedParent?.root ?? builder;
  const validation =
    scopedParent?.validation ?? (validationOnly ? { active: true } : undefined);
  if (state.preparingRoot && state.preparingRoot !== root) {
    const error = new Error(
      "root actions must be prepared and saved sequentially; await each save and reload before preparing the next action",
    );
    failTransaction(state, error);
    throw error;
  }
  if (!state.preparingRoot) {
    state.preparingRoot = root;
    state.preparingValidation = validation;
  }
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
      // If a trigger's Promise.all rejects, other children can still be running.
      // Wait for descendants before restoring this action or completing root
      // validation. The action must not wait on its own preparation promise.
      if (node.pending) {
        do {
          await Promise.allSettled([...node.pending]);
          // Completed SQL or loader reads can resume several asynchronous
          // wrappers before child preparation starts. Allow one event loop turn
          // for those wrappers to register reads and children before checking again.
          await new Promise<void>((resolve) => setImmediate(resolve));
        } while (node.pending.size);
      }
      if (validation && validation !== scopedParent?.validation) {
        validation.active = false;
        if (state.preparingValidation === validation) {
          state.preparingRoot = undefined;
          state.preparingValidation = undefined;
        }
      }
    }
  });
  state.pendingPreparations.add(prepared);
  void prepared.then(
    () => state.pendingPreparations.delete(prepared),
    () => state.pendingPreparations.delete(prepared),
  );
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
  // Track the returned promise without throwing and leaving it unhandled.
  // The read reports an error if its scope has closed.
  const state = transactionStorage.getStore();
  const final = finalValidationStorage.getStore();
  if (state?.active && final?.active && final.transaction === state) {
    final.pending.add(read);
    void read.then(
      () => final.pending.delete(read),
      () => final.pending.delete(read),
    );
  }
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
  // Attach rejection handlers even if this scope closed while work was starting.
  // The supplied promises already exist and must not become unhandled rejections.
  const promises = Array.from(work, (pending) => Promise.resolve(pending));
  let validation: boolean;
  try {
    validation = isValidationPreparation();
  } catch (error) {
    await Promise.allSettled(promises);
    throw error;
  }
  if (!validation) {
    return Promise.all(promises);
  }
  let failed = false;
  let failure: unknown;
  const results = await Promise.all(
    promises.map((pending) =>
      pending.catch((error) => {
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

export function setExecutorBuilders(
  executor: Executor,
  builders: readonly TransactionBuilderIdentity[],
) {
  executorBuilders.set(executor, builders);
  executorReads.set(executor, getTransactionReadState());
}

export function setExecutorScopeValidators(
  executor: Executor,
  validators: readonly ActionScopeValidator[],
) {
  executorValidators.set(executor, validators);
}

export function getExecutorScopeValidators(executor: Executor) {
  return executorValidators.get(executor) ?? [];
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

export function completeActionPreparation(
  state: TransactionState,
  executor: Executor,
) {
  const builders = getExecutorBuilders(executor);
  state.preparingRoot = undefined;
  state.preparingValidation = undefined;
  state.generation++;
  state.edgeMetadataLoader = undefined;
  for (const cache of state.caches.values()) {
    cache.clearCache();
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
      "recreate queries and loaders after each save; a read cannot cross transaction generations",
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
      "reload existingEnt inside the withTransactionScope callback on every attempt",
    );
    failTransaction(state, error);
    throw error;
  }
}

export function getTransactionState(): TransactionState | undefined {
  const state = transactionStorage.getStore();
  if (state && !state.active) {
    throw new Error(
      "transaction scope is closed; await all work inside withTransactionScope",
    );
  }
  if (state?.validating) {
    const validation = finalValidationStorage.getStore();
    if (validation?.transaction !== state || !validation.active) {
      const error = new Error(
        "transaction callback is closed; await all work before scope validation",
      );
      failTransaction(state, error);
      throw error;
    }
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
// caller catches it before the withTransactionScope callback returns.
export async function runActionExecution<T>(
  execute: () => Promise<T>,
): Promise<T> {
  const state = getTransactionState();
  let pending: Promise<T> | undefined;
  try {
    assertActionPreparationAllowed();
    pending = execute();
    state?.pendingActions.add(pending);
    return await pending;
  } catch (error) {
    if (state) {
      failTransaction(state, error);
    }
    throw error;
  } finally {
    if (pending) {
      state?.pendingActions.delete(pending);
    }
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
      "create loaders and queries inside the withTransactionScope callback; loaders cannot cross transaction scopes",
    );
  }
}
