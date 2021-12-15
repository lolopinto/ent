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

export interface ActionOptions<T extends Ent> {
  existingEnt?: T | null;
  input?: {};
  operation?: WriteOperation;
}

interface EntBuilder<T extends Ent> extends Builder<T> {
  valid(): Promise<boolean>;
  validX(): Promise<void>;
  save(): Promise<void>;
  saveX(): Promise<void>;
  editedEnt(): Promise<T | null>;
  editedEntX(): Promise<T>;
}

export class BaseAction<T extends Ent> implements Action<T> {
  builder: EntBuilder<T>;
  private input: {};
  triggers: Trigger<Ent>[] = [];
  observers: Observer<Ent>[] = [];
  validators: Validator<Ent>[] = [];

  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  constructor(
    public viewer: Viewer,
    public builderCtr: BuilderConstructor<T>,
    options?: ActionOptions<T> | null,
  ) {
    let operation = options?.operation;
    if (!operation) {
      if (options?.existingEnt) {
        operation = WriteOperation.Edit;
      } else {
        operation = WriteOperation.Insert;
      }
    }
    this.input = options?.input || {};
    this.builder = new builderCtr(
      viewer,
      operation,
      this,
      options?.existingEnt || undefined,
    );
  }

  static createBuilder<T extends Ent>(
    viewer: Viewer,
    builderCtr: BuilderConstructor<T>,
    options?: ActionOptions<T> | null,
  ): Builder<T> {
    let action = new BaseAction(viewer, builderCtr, options);
    return action.builder;
  }

  // perform a bulk action in a transaction rooted on ent T
  // it ends up creating triggers and having all the given actions performed in a transaction
  static bulkAction<T extends Ent>(
    ent: T,
    builderCtr: BuilderConstructor<T>,
    ...actions: Action<Ent>[]
  ): BaseAction<T> {
    let action = new BaseAction(ent.viewer, builderCtr, {
      existingEnt: ent,
    });
    action.triggers = [
      {
        changeset: (builder: Builder<T>, _input): Promise<Changeset<Ent>>[] => {
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

  async save(): Promise<T | null> {
    await this.builder.save();
    return await this.builder.editedEnt();
  }

  async saveX(): Promise<T> {
    await this.builder.saveX();
    return await this.builder.editedEntX();
  }

  getInput() {
    return this.input;
  }
}

interface BuilderConstructor<T extends Ent> {
  new (
    viewer: Viewer,
    operation: WriteOperation,
    action: Action<T>,
    existingEnt?: T | undefined,
  ): EntBuilder<T>;
}

// this provides a way to just update a row in the database.
// skips privacy, triggers, observers, etc
// does do field validation
// note that only editable fields in the builder can be passed here
export async function updateRawObject<TEnt extends Ent, TInput extends Data>(
  viewer: Viewer,
  builderCtr: BuilderConstructor<TEnt>,
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
export function getSimpleEditAction<TEnt extends Ent, TInput extends Data>(
  viewer: Viewer,
  builderCtr: BuilderConstructor<TEnt>,
  existingEnt: TEnt,
  input: TInput,
): Action<TEnt> {
  return new BaseAction(viewer, builderCtr, {
    existingEnt: existingEnt,
    operation: WriteOperation.Edit,
    input,
  });
}
