import type { Builder, Executor } from "../action/action";
import type { Ent, Viewer } from "../core/base";
import {
  hasActionResultTransaction,
  isPreparingAction,
  recordActionResultTransaction,
  runInActionPreparation,
  setExecutorBuilders,
} from "../core/transaction_context";

export function checkTransactionBuilderTypes<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
  TExistingEnt extends TEnt | null,
>(
  builder: Builder<TEnt, TViewer, TExistingEnt>,
  ent: TEnt,
  executor: Executor,
) {
  hasActionResultTransaction(builder);
  isPreparingAction(builder);
  recordActionResultTransaction(ent, builder);
  runInActionPreparation(builder, async () => undefined);
  setExecutorBuilders(executor, [builder]);
}
import type { Action } from "../action/action";
import type { ScopeValidationContext } from "../action";

export function checkFinalValidationTypes<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  action: Action<TEnt, Builder<TEnt, TViewer>, TViewer>,
  context: ScopeValidationContext,
) {
  action.validateBeforeCommit?.(context);
  context.query("SELECT 1");
  context.queryAll("SELECT 1");
  // @ts-expect-error Final validation cannot execute writes.
  context.exec("UPDATE accounts SET amount = 0");
  // @ts-expect-error Final validation cannot commit the scope.
  context.commit();
}
