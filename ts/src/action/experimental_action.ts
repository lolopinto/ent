import { Orchestrator } from "./orchestrator";
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

export interface ActionOptions<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
  TData extends Data,
  TExistingEnt extends TMaybleNullableEnt<TEnt> = MaybeNull<TEnt>,
> {
  existingEnt: TExistingEnt;
  input?: TData;
  operation?: WriteOperation;
}

type MaybeNull<T extends Ent> = T | null;
type TMaybleNullableEnt<T extends Ent> = T | MaybeNull<T>;

export interface EntBuilder<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
  TInput extends Data,
  TExistingEnt extends TMaybleNullableEnt<TEnt> = MaybeNull<TEnt>,
> extends Builder<TEnt, TViewer, TExistingEnt> {
  valid(): Promise<boolean>;
  validX(): Promise<void>;
  save(): Promise<void>;
  saveX(): Promise<void>;
  editedEnt(): Promise<TEnt | null>;
  editedEntX(): Promise<TEnt>;
  getInput(): TInput;
  orchestrator: Orchestrator<TEnt, TInput, TViewer, TExistingEnt>;
}

export class BaseAction<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
  TInput extends Data,
  TExistingEnt extends TMaybleNullableEnt<TEnt> = MaybeNull<TEnt>,
> implements
    Action<
      TEnt,
      EntBuilder<TEnt, TViewer, TInput, TExistingEnt>,
      TViewer,
      TInput,
      TExistingEnt
    >
{
  builder: EntBuilder<TEnt, TViewer, TInput, TExistingEnt>;
  private input: TInput;

  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  getTriggers(): Trigger<
    TEnt,
    EntBuilder<TEnt, TViewer, TInput, TExistingEnt>,
    TViewer,
    TInput,
    TExistingEnt
  >[] {
    return [];
  }

  getObservers(): Observer<
    TEnt,
    EntBuilder<TEnt, TViewer, TInput, TExistingEnt>,
    TViewer,
    TInput,
    TExistingEnt
  >[] {
    return [];
  }

  getValidators(): Validator<
    TEnt,
    EntBuilder<TEnt, TViewer, TInput, TExistingEnt>,
    TViewer,
    TInput,
    TExistingEnt
  >[] {
    return [];
  }

  constructor(
    public viewer: TViewer,
    public builderCtr: BuilderConstructor<TEnt, TViewer, TInput, TExistingEnt>,
    options: ActionOptions<TEnt, TViewer, TInput, TExistingEnt>,
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
    this.builder = new builderCtr(viewer, operation, this, options.existingEnt);
  }

  static createBuilder<
    TEnt extends Ent<TViewer>,
    TViewer extends Viewer,
    TInput extends Data,
    TExistingEnt extends TMaybleNullableEnt<TEnt> = MaybeNull<TEnt>,
  >(
    viewer: Viewer,
    builderCtr: BuilderConstructor<TEnt, TViewer, TInput, TExistingEnt>,
    options: ActionOptions<TEnt, TViewer, TInput, TExistingEnt>,
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
    builderCtr: BuilderConstructor<TEnt, TViewer, TInput, TEnt>,
    ...actions: Action<Ent, Builder<Ent, any>>[]
  ): BaseAction<TEnt, TViewer, TInput, TEnt> {
    let action = new BaseAction(ent.viewer, builderCtr, {
      existingEnt: ent,
    });
    action.getTriggers = () => [
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

export interface BuilderConstructor<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
  TInput extends Data,
  TExistingEnt extends TMaybleNullableEnt<TEnt> = MaybeNull<TEnt>,
> {
  new (
    viewer: TViewer,
    operation: WriteOperation,
    action: Action<
      TEnt,
      any,
      //      EntBuilder<TEnt, TViewer, TInput, TExistingEnt>,
      TViewer,
      TInput,
      TExistingEnt
    >,
    existingEnt: TExistingEnt,
  ): EntBuilder<TEnt, TViewer, TInput, TExistingEnt>;
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
  viewer: TViewer,
  builderCtr: BuilderConstructor<TEnt, TViewer, TInput, TEnt>,
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

// TODO need to fix types for all these

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
  builderCtr: BuilderConstructor<TEnt, TViewer, TInput, TEnt>,
  existingEnt: TEnt,
  input: TInput,
): BaseAction<TEnt, TViewer, TInput, TEnt> {
  return new BaseAction(viewer, builderCtr, {
    existingEnt: existingEnt,
    operation: WriteOperation.Edit,
    input,
  });
}

export function getSimpleDeleteAction<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
  TInput extends Data,
>(
  viewer: TViewer,
  builderCtr: BuilderConstructor<TEnt, TViewer, TInput, TEnt>,
  existingEnt: TEnt,
  input: TInput,
): BaseAction<TEnt, TViewer, TInput, TEnt> {
  return new BaseAction(viewer, builderCtr, {
    existingEnt: existingEnt,
    operation: WriteOperation.Delete,
    input,
  });
}

export function getSimpleInsertAction<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
  TInput extends Data,
>(
  viewer: TViewer,
  builderCtr: BuilderConstructor<TEnt, TViewer, TInput, null>,
  input: TInput,
): BaseAction<TEnt, TViewer, TInput, null> {
  return new BaseAction(viewer, builderCtr, {
    operation: WriteOperation.Insert,
    input,
    existingEnt: null,
  });
}
