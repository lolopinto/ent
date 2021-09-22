// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  AssocEdgeInputOptions,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import {
  Action,
  Builder,
  Changeset,
  WriteOperation,
} from "@snowtop/ent/action";
import { Tag, Todo } from "src/ent/";
import {
  TodoBuilder,
  TodoInput,
} from "src/ent/todo/actions/generated/todo_builder";

export class TodoAddTagActionBase implements Action<Todo> {
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

  addTag(...ids: ID[]): this;
  addTag(...nodes: Tag[]): this;
  addTag(...nodes: Builder<Tag>[]): this;
  addTag(...nodes: ID[] | Tag[] | Builder<Tag>[]): this {
    nodes.forEach((node) => this.builder.addTag(node));
    return this;
  }

  addTagID(id: ID | Builder<Tag>, options?: AssocEdgeInputOptions): this {
    this.builder.addTagID(id, options);
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
    return await this.builder.editedEnt();
  }

  async saveX(): Promise<Todo> {
    await this.builder.saveX();
    return await this.builder.editedEntX();
  }

  static create<T extends TodoAddTagActionBase>(
    this: new (viewer: Viewer, todo: Todo) => T,
    viewer: Viewer,
    todo: Todo,
  ): TodoAddTagActionBase {
    return new this(viewer, todo);
  }

  static async saveXFromID<T extends TodoAddTagActionBase>(
    this: new (viewer: Viewer, todo: Todo) => T,
    viewer: Viewer,
    id: ID,
    tagID: ID,
  ): Promise<Todo> {
    let todo = await Todo.loadX(viewer, id);
    return await new this(viewer, todo).addTag(tagID).saveX();
  }
}
