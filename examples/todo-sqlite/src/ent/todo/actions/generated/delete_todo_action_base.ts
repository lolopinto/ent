// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import { Action, Changeset, WriteOperation } from "@snowtop/ent/action";
import { Todo } from "src/ent/";
import { TodoBuilder, TodoInput } from "src/ent/todo/actions/todo_builder";

export class DeleteTodoActionBase implements Action<Todo> {
  public readonly builder: TodoBuilder;
  public readonly viewer: Viewer;
  protected todo: Todo;

  constructor(viewer: Viewer, todo: Todo) {
    this.viewer = viewer;
    this.builder = new TodoBuilder(
      this.viewer,
      WriteOperation.Delete,
      this,
      todo,
    );
    this.todo = todo;
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): TodoInput {
    return {};
  }

  async changeset(): Promise<Changeset<Todo>> {
    return this.builder.build();
  }

  async valid(): Promise<boolean> {
    return this.builder.valid();
  }

  async validX(): Promise<void> {
    await this.builder.validX();
  }

  async save(): Promise<void> {
    await this.builder.save();
  }

  async saveX(): Promise<void> {
    await this.builder.saveX();
  }

  static create<T extends DeleteTodoActionBase>(
    this: new (viewer: Viewer, todo: Todo) => T,
    viewer: Viewer,
    todo: Todo,
  ): DeleteTodoActionBase {
    return new this(viewer, todo);
  }

  static async saveXFromID<T extends DeleteTodoActionBase>(
    this: new (viewer: Viewer, todo: Todo) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<void> {
    let todo = await Todo.loadX(viewer, id);
    return await new this(viewer, todo).saveX();
  }
}
