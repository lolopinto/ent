// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import { Action, Changeset, WriteOperation } from "@snowtop/ent/action";
import { Tag, Todo } from "src/ent/";
import {
  TodoBuilder,
  TodoInput,
} from "src/ent/todo/actions/generated/todo_builder";

export class TodoRemoveTagActionBase implements Action<Todo> {
  public readonly builder: TodoBuilder;
  public readonly viewer: Viewer;
  protected todo: Todo;

  constructor(viewer: Viewer, todo: Todo) {
    this.viewer = viewer;
    this.builder = new TodoBuilder(
      this.viewer,
      WriteOperation.Edit,
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

  removeTag(...nodes: (ID | Tag)[]): this {
    nodes.forEach((node) => this.builder.removeTag(node));
    return this;
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

  async save(): Promise<Todo | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<Todo> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends TodoRemoveTagActionBase>(
    this: new (viewer: Viewer, todo: Todo) => T,
    viewer: Viewer,
    todo: Todo,
  ): TodoRemoveTagActionBase {
    return new this(viewer, todo);
  }

  static async saveXFromID<T extends TodoRemoveTagActionBase>(
    this: new (viewer: Viewer, todo: Todo) => T,
    viewer: Viewer,
    id: ID,
    tagID: ID,
  ): Promise<Todo> {
    const todo = await Todo.loadX(viewer, id);
    return await new this(viewer, todo).removeTag(tagID).saveX();
  }
}
