import {
  DataOperation,
  Ent,
  EntConstructor,
  Viewer,
  ID,
  CreateRowOperation,
} from "./ent";
import { PrivacyPolicy } from "./privacy";

export enum ActionOperation {
  Create = 1,
  Edit,
  Delete,
  Mutations,
  AddEdge,
  RemoveEdge,
  EdgeGroup,
}

export interface Builder<T extends Ent> {
  existingEnt: Ent | null;
  ent: EntConstructor<T>;
  placeholderID: ID;
  viewer: Viewer;
  build: Changeset<T>;
  operation: ActionOperation;
}

export interface Executor extends Iterator<DataOperation> {
  resolveValue(val: any): Ent;
}

export interface Changeset<T extends Ent> {
  executor: Executor;
  viewer: Viewer;
  placeholderID: ID;
  ent: EntConstructor<T>;
  changesets?: Changeset<T>[];
  dependencies?: Map<ID, Builder<T>>;
}

export interface Trigger<T extends Ent> {
  changeset(): Changeset<T> | null; // TODO type
}

export interface Observer {
  observe();
}

export interface Validator {
  validate();
}

export interface Action<T extends Ent> {
  viewer: Viewer;
  changeset(): Changeset<T>;
  ent: Ent;
  builder: Builder<T>;
  privacyPolicy?: PrivacyPolicy;
  triggers?: Trigger<T>[];
  observers?: Observer[];
  validators?: Validator[];
}

class ListBasedExecutor implements Executor {
  private idx: number;
  constructor(private operations: DataOperation[]) {}
  resolveValue(val: any): Ent {
    throw new Error();
  }

  next(): IteratorResult<DataOperation> {
    const op = this.operations[this.idx];
    const done = this.idx == this.operations.length - 1;
    this.idx++;
    return {
      value: op,
      done: done,
    };
  }
}
