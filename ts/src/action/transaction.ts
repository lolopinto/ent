import { Ent, Viewer, ViewerWithContext } from "../core/base";
import { Action, Builder, Changeset } from "./action";
import { ComplexExecutor } from "./executor";

type ActionAny = Action<
  Ent<Viewer<any, any>>,
  Builder<Ent<Viewer<any, any>>, Viewer<any, any>, any>,
  Viewer<any, any>,
  any,
  any
>;

export class Transaction {
  constructor(
    private viewer: Viewer,
    // independent operations
    private actions: ActionAny[], // TODO ops for different types of transaction
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
