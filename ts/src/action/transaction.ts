import { Ent, Viewer, Data } from "../core/base.js";
import { Action, Changeset } from "./action.js";
import { ComplexExecutor } from "./executor.js";
import { EntBuilder } from "./experimental_action.js";

type MaybeNull<T extends Ent> = T | null;
type TMaybleNullableEnt<T extends Ent> = T | MaybeNull<T>;

type ActionAny<TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
  TInput extends Data,
    TExistingEnt extends TMaybleNullableEnt<TEnt> = MaybeNull<TEnt>,
  > = Action<TEnt, EntBuilder<TEnt, TViewer, TInput, TExistingEnt>, TViewer, TInput, TExistingEnt>;

export class Transaction<TViewer extends Viewer = Viewer> {
  constructor(
    private viewer: TViewer,
    // independent operations
    private actions: ActionAny<any, TViewer, Data>[], // TODO ops for different types of transaction
  ) {}

  async run() {
    const changesets: Changeset[] = [];
    await Promise.all(
      this.actions.map(async (action) => {
        const c = await action.changeset();
        changesets.push(c);
      }),
    );

    const executor = new ComplexExecutor(
      this.viewer,
      "", // no placeholder, no opers
      [],
      new Map(),
      changesets,
    );
    await executor.execute();
  }
}
