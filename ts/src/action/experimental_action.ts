import { Viewer, Ent, Data } from "../core/base";
import { AlwaysAllowPrivacyPolicy } from "../core/privacy";
import {
  Action,
  WriteOperation,
  Builder,
  Trigger,
  Observer,
  Changeset,
  Validator,
} from "./action";

export interface ActionOptions<T extends Ent, TData extends Data> {
  existingEnt?: T | null;
  input?: TData;
  operation?: WriteOperation;
}

interface EntBuilder<TEnt extends Ent<TViewer>, TViewer extends Viewer>
  extends Builder<TEnt, TViewer> {
  valid(): Promise<boolean>;
  validX(): Promise<void>;
  save(): Promise<void>;
  saveX(): Promise<void>;
  editedEnt(): Promise<TEnt | null>;
  editedEntX(): Promise<TEnt>;
}

export class BaseAction<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
  TInput extends Data,
> implements Action<TEnt, EntBuilder<TEnt, TViewer>, TViewer, TInput>
{
  builder: EntBuilder<TEnt, TViewer>;
  private input: TInput;
  triggers: Trigger<TEnt, EntBuilder<TEnt, TViewer>, TViewer, TInput>[] = [];
  observers: Observer<TEnt, EntBuilder<TEnt, TViewer>, TViewer, TInput>[] = [];
  validators: Validator<TEnt, EntBuilder<TEnt, TViewer>, TViewer, TInput>[] =
    [];

  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  constructor(
    public viewer: TViewer,
    public builderCtr: BuilderConstructor<TEnt, TViewer, TInput>,
    options?: ActionOptions<TEnt, TInput> | null,
  ) {
    let operation = options?.operation;
    if (!operation) {
      if (options?.existingEnt) {
        operation = WriteOperation.Edit;
      } else {
        operation = WriteOperation.Insert;
      }
    }
    this.input = options?.input || ({} as TInput);
    this.builder = new builderCtr(
      viewer,
      operation,
      this,
      options?.existingEnt || null,
    );
  }

  static createBuilder<
    TEnt extends Ent<TViewer>,
    TViewer extends Viewer,
    TInput extends Data,
  >(
    viewer: Viewer,
    builderCtr: BuilderConstructor<TEnt, TViewer, TInput>,
    options?: ActionOptions<TEnt, TInput> | null,
  ): Builder<TEnt> {
    let action = new BaseAction(viewer, builderCtr, options);
    return action.builder;
  }

  // perform a bulk action in a transaction rooted on ent T
  // it ends up creating triggers and having all the given actions performed in a transaction
  static bulkAction<
    TEnt extends Ent<TViewer>,
    TViewer extends Viewer,
    TInput extends Data,
  >(
    ent: TEnt,
    builderCtr: BuilderConstructor<TEnt, TViewer, TInput>,
    ...actions: Action<Ent, Builder<Ent, Viewer>, Viewer, Data>[]
  ): BaseAction<TEnt, TViewer, TInput> {
    let action = new BaseAction(ent.viewer, builderCtr, {
      existingEnt: ent,
    });
    action.triggers = [
      {
        changeset: (): Promise<Changeset>[] => {
          return actions.map((action) => action.changeset());
        },
      },
    ];
    return action;
  }

  changeset() {
    return this.builder.build();
  }

  async valid() {
    return this.builder.valid();
  }

  async validX() {
    return this.builder.validX();
  }

  async save(): Promise<TEnt | null> {
    await this.builder.save();
    return await this.builder.editedEnt();
  }

  async saveX(): Promise<TEnt> {
    await this.builder.saveX();
    return await this.builder.editedEntX();
  }

  getInput() {
    return this.input;
  }
}

interface BuilderConstructor<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
  TInput extends Data,
> {
  new (
    viewer: Viewer,
    operation: WriteOperation,
    action: Action<TEnt, EntBuilder<TEnt, TViewer>, TViewer, TInput>,
    existingEnt: TEnt | null,
  ): EntBuilder<TEnt, TViewer>;
}

// this provides a way to just update a row in the database.
// skips privacy, triggers, observers, etc
// does do field validation
// note that only editable fields in the builder can be passed here
export async function updateRawObject<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
  TInput extends Data,
>(
  viewer: Viewer,
  builderCtr: BuilderConstructor<TEnt, TViewer, TInput>,
  existingEnt: TEnt,
  input: TInput,
) {
  const action = new BaseAction(viewer, builderCtr, {
    existingEnt: existingEnt,
    operation: WriteOperation.Edit,
    input,
  });
  return action.saveX();
}

// creates an action which has no privacy, triggers, observers etc
// does do field validation
// useful to batch a bunch of writes together with BaseAction.bulkAction
// note that only editable fields in the builder can be passed here
export function getSimpleEditAction<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
  TInput extends Data,
>(
  viewer: TViewer,
  builderCtr: BuilderConstructor<TEnt, TViewer, TInput>,
  existingEnt: TEnt,
  input: TInput,
): Action<TEnt, Builder<TEnt, TViewer>, TViewer, TInput> {
  return new BaseAction(viewer, builderCtr, {
    existingEnt: existingEnt,
    operation: WriteOperation.Edit,
    input,
  });
}
