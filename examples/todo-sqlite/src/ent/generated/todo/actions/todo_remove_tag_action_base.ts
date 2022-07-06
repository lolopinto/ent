// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import {
  Action,
  Changeset,
  Observer,
  Trigger,
  Validator,
  WriteOperation,
} from "@snowtop/ent/action";
import { Tag, Todo } from "src/ent/";
import {
  TodoBuilder,
  TodoInput,
} from "src/ent/generated/todo/actions/todo_builder";

export type TodoRemoveTagActionTriggers = (
  | Trigger<Todo, TodoBuilder<TodoInput, Todo>, Viewer, TodoInput, Todo>
  | Trigger<Todo, TodoBuilder<TodoInput, Todo>, Viewer, TodoInput, Todo>[]
)[];

export type TodoRemoveTagActionObservers = Observer<
  Todo,
  TodoBuilder<TodoInput, Todo>,
  Viewer,
  TodoInput,
  Todo
>[];

export type TodoRemoveTagActionValidators = Validator<
  Todo,
  TodoBuilder<TodoInput, Todo>,
  Viewer,
  TodoInput,
  Todo
>[];

export class TodoRemoveTagActionBase
  implements
    Action<Todo, TodoBuilder<TodoInput, Todo>, Viewer, TodoInput, Todo>
{
  public readonly builder: TodoBuilder<TodoInput, Todo>;
  public readonly viewer: Viewer;
  protected readonly todo: Todo;

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

  getPrivacyPolicy(): PrivacyPolicy<Todo> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): TodoRemoveTagActionTriggers {
    return [];
  }

  getObservers(): TodoRemoveTagActionObservers {
    return [];
  }

  getValidators(): TodoRemoveTagActionValidators {
    return [];
  }

  getInput(): TodoInput {
    return {};
  }

  removeTag(...nodes: (ID | Tag)[]): this {
    nodes.forEach((node) => this.builder.removeTag(node));
    return this;
  }
  async changeset(): Promise<Changeset> {
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
  ): T {
    return new this(viewer, todo);
  }

  static async saveXFromID<T extends TodoRemoveTagActionBase>(
    this: new (viewer: Viewer, todo: Todo) => T,
    viewer: Viewer,
    id: ID,
    tagID: ID,
  ): Promise<Todo> {
    const todo = await Todo.loadX(viewer, id);
    return new this(viewer, todo).removeTag(tagID).saveX();
  }
}