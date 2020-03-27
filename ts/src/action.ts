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

export enum WriteOperation {
  Insert = "insert",
  Edit = "edit",
  Delete = "delete",
}

export interface Builder<T extends Ent> {
  existingEnt?: Ent;
  ent: EntConstructor<T>;
  placeholderID: ID;
  viewer: Viewer;
  build(): Promise<Changeset<T>>;
  operation: WriteOperation;
}

export interface Executor
  extends Iterable<DataOperation>,
    Iterator<DataOperation> {
  resolveValue(val: any): Ent;
}

export interface Changeset<T extends Ent> {
  executor(): Executor;
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
  changeset(): Promise<Changeset<T>>;
  //ent: EntConstructor<T>;
  builder: Builder<T>;
  privacyPolicy?: PrivacyPolicy;
  triggers?: Trigger<T>[];
  observers?: Observer[];
  validators?: Validator[];
}
