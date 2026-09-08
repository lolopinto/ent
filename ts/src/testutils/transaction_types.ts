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
