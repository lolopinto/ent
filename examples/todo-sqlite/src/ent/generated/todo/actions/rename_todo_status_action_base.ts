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
import { TodoBuilder } from "src/ent/generated/todo/actions/todo_builder";

export interface RenameTodoInput {
  text?: string;
  reasonForChange?: string | null;
}

export type RenameTodoStatusActionTriggers = (
  | Trigger<
      Todo,
      TodoBuilder<RenameTodoInput, Todo>,
      Viewer,
      RenameTodoInput,
      Todo
    >
  | Trigger<
      Todo,
      TodoBuilder<RenameTodoInput, Todo>,
      Viewer,
      RenameTodoInput,
      Todo
    >[]
)[];

export type RenameTodoStatusActionObservers = Observer<
  Todo,
  TodoBuilder<RenameTodoInput, Todo>,
  Viewer,
  RenameTodoInput,
  Todo
>[];

export type RenameTodoStatusActionValidators = Validator<
  Todo,
  TodoBuilder<RenameTodoInput, Todo>,
  Viewer,
  RenameTodoInput,
  Todo
>[];

export class RenameTodoStatusActionBase
  implements
    Action<
      Todo,
      TodoBuilder<RenameTodoInput, Todo>,
      Viewer,
      RenameTodoInput,
      Todo
    >
{
  public readonly builder: TodoBuilder<RenameTodoInput, Todo>;
  public readonly viewer: Viewer;
  protected input: RenameTodoInput;
  protected readonly todo: Todo;

  constructor(viewer: Viewer, todo: Todo, input: RenameTodoInput) {
    this.viewer = viewer;

    this.input = input;

    this.builder = new TodoBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      todo,
    );
    this.todo = todo;
  }

  getPrivacyPolicy(): PrivacyPolicy<Todo, Viewer> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): RenameTodoStatusActionTriggers {
    return [];
  }

  getObservers(): RenameTodoStatusActionObservers {
    return [];
  }

  getValidators(): RenameTodoStatusActionValidators {
    return [];
  }

  getInput(): RenameTodoInput {
    return this.input;
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

  static create<T extends RenameTodoStatusActionBase>(
    this: new (
      viewer: Viewer,
      todo: Todo,
      input: RenameTodoInput,
    ) => T,
    viewer: Viewer,
    todo: Todo,
    input: RenameTodoInput,
  ): T {
    return new this(viewer, todo, input);
  }

  static async saveXFromID<T extends RenameTodoStatusActionBase>(
    this: new (
      viewer: Viewer,
      todo: Todo,
      input: RenameTodoInput,
    ) => T,
    viewer: Viewer,
    id: ID,
    input: RenameTodoInput,
  ): Promise<Todo> {
    const todo = await Todo.loadX(viewer, id);
    return new this(viewer, todo, input).saveX();
  }
}
