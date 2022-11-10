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
import { Todo } from "src/ent/";
import {
  TodoBuilder,
  TodoInput,
} from "src/ent/generated/todo/actions/todo_builder";

export type DeleteTodoActionTriggers = (
  | Trigger<Todo, TodoBuilder<TodoInput, Todo>, Viewer, TodoInput, Todo>
  | Trigger<Todo, TodoBuilder<TodoInput, Todo>, Viewer, TodoInput, Todo>[]
)[];

export type DeleteTodoActionObservers = Observer<
  Todo,
  TodoBuilder<TodoInput, Todo>,
  Viewer,
  TodoInput,
  Todo
>[];

export type DeleteTodoActionValidators = Validator<
  Todo,
  TodoBuilder<TodoInput, Todo>,
  Viewer,
  TodoInput,
  Todo
>[];

export class DeleteTodoActionBase
  implements Action<Todo, TodoBuilder<TodoInput, Todo>, Viewer, TodoInput, Todo>
{
  public readonly builder: TodoBuilder<TodoInput, Todo>;
  public readonly viewer: Viewer;
  protected readonly todo: Todo;

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

  getPrivacyPolicy(): PrivacyPolicy<Todo, Viewer> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): DeleteTodoActionTriggers {
    return [];
  }

  getObservers(): DeleteTodoActionObservers {
    return [];
  }

  getValidators(): DeleteTodoActionValidators {
    return [];
  }

  getInput(): TodoInput {
    return {};
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

  async save(): Promise<void> {
    await this.builder.save();
  }

  async saveX(): Promise<void> {
    await this.builder.saveX();
  }

  async saveWithoutTransform(): Promise<void> {
    this.builder.orchestrator.setDisableTransformations(true);
    await this.builder.save();
  }

  async saveWithoutTransformX(): Promise<void> {
    this.builder.orchestrator.setDisableTransformations(true);
    await this.builder.saveX();
  }

  static create<T extends DeleteTodoActionBase>(
    this: new (
      viewer: Viewer,
      todo: Todo,
    ) => T,
    viewer: Viewer,
    todo: Todo,
  ): T {
    return new this(viewer, todo);
  }

  static async saveXFromID<T extends DeleteTodoActionBase>(
    this: new (
      viewer: Viewer,
      todo: Todo,
    ) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<void> {
    const todo = await Todo.loadX(viewer, id);
    return new this(viewer, todo).saveX();
  }
}
