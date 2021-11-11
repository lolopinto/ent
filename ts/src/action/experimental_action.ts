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
    public builderCtr: BuilderConstructor<TEnt, TData>,
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

  static createBuilder<TEnt extends Ent, TData extends Data>(
    viewer: Viewer,
    builderCtr: BuilderConstructor<TEnt, TData>,
    options?: ActionOptions<TEnt, TData> | null,
  ): Builder<TEnt> {
    let action = new BaseAction(viewer, builderCtr, options);
    return action.builder;
  }

  // perform a bulk action in a transaction rooted on ent T
  // it ends up creating triggers and having all the given actions performed in a transaction
  static bulkAction<TEnt extends Ent, TData extends Data>(
    ent: TEnt,
    builderCtr: BuilderConstructor<TEnt, TData>,
    ...actions: Action<Ent, Builder<Ent>, Data>[]
  ): BaseAction<TEnt, TData> {
    let action = new BaseAction(ent.viewer, builderCtr, {
      existingEnt: ent,
    });
    action.triggers = [
      {
        changeset: (): Promise<Changeset<Ent>>[] => {
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

interface BuilderConstructor<TEnt extends Ent, TData extends Data> {
  new (
    viewer: Viewer,
    operation: WriteOperation,
    action: Action<TEnt, EntBuilder<TEnt>, TData>,
    existingEnt?: TEnt | undefined,
  ): EntBuilder<TEnt>;
}
