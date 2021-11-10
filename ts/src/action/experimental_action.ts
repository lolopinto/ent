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

interface EntBuilder<T extends Ent> extends Builder<T> {
  valid(): Promise<boolean>;
  validX(): Promise<void>;
  save(): Promise<void>;
  saveX(): Promise<void>;
  editedEnt(): Promise<T | null>;
  editedEntX(): Promise<T>;
}

export class BaseAction<TEnt extends Ent, TData extends Data>
  implements Action<TEnt, EntBuilder<TEnt>, TData>
{
  builder: EntBuilder<TEnt>;
  private input: TData;
  triggers: Trigger<EntBuilder<TEnt>, TData>[] = [];
  observers: Observer<EntBuilder<TEnt>, TData>[] = [];
  validators: Validator<EntBuilder<TEnt>, TData>[] = [];

  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  constructor(
    public viewer: Viewer,
    public builderCtr: BuilderConstructor<TEnt>,
    options?: ActionOptions<TEnt, TData> | null,
  ) {
    let operation = options?.operation;
    if (!operation) {
      if (options?.existingEnt) {
        operation = WriteOperation.Edit;
      } else {
        operation = WriteOperation.Insert;
      }
    }
    this.input = options?.input || ({} as TData);
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
    options?: ActionOptions<T, Data> | null,
  ): Builder<T> {
    let action = new BaseAction(viewer, builderCtr, options);
    return action.builder;
  }

  // perform a bulk action in a transaction rooted on ent T
  // it ends up creating triggers and having all the given actions performed in a transaction
  static bulkAction<T extends Ent>(
    ent: T,
    builderCtr: BuilderConstructor<T>,
    ...actions: Action<T, Builder<T>, Data>[]
  ): BaseAction<T, Data> {
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

interface BuilderConstructor<T extends Ent> {
  new (
    viewer: Viewer,
    operation: WriteOperation,
    action: Action<T, Builder<T>, Data>,
    existingEnt?: T | undefined,
  ): EntBuilder<T>;
}
