import { Ent, Viewer } from "../core/base";
import { Action, Builder, Changeset } from "./action";
import { ComplexExecutor } from "./executor";

type ActionAny<TViewer extends Viewer = Viewer> = Action<
  Ent<TViewer>,
  Builder<Ent<TViewer>, TViewer, any>,
  Viewer<any, any>,
  any,
  any
>;

export class Transaction<TViewer extends Viewer = Viewer> {
  constructor(
    private viewer: TViewer,
    // independent operations
    private actions: ActionAny<TViewer>[], // TODO ops for different types of transaction
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
