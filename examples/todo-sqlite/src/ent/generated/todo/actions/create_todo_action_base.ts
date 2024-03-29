// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import {
  Action,
  Builder,
  Changeset,
  ChangesetOptions,
  Observer,
  Trigger,
  Validator,
  WriteOperation,
} from "@snowtop/ent/action";
import { Account, Todo } from "src/ent/";
import { TodoBuilder } from "src/ent/generated/todo/actions/todo_builder";

interface customTagInput {
  displayName: string;
  relatedTagIds?: ID[] | null;
  canonicalName?: string;
}

export interface TodoCreateInput {
  id?: ID;
  createdAt?: Date;
  updatedAt?: Date;
  text: string;
  creatorId: ID | Builder<Account, Viewer>;
  assigneeId: ID | Builder<Account, Viewer>;
  scopeId: ID;
  scopeType: string;
  bounty?: number | null;
  tags?: customTagInput[];
}

export type CreateTodoActionTriggers = (
  | Trigger<
      Todo,
      TodoBuilder<TodoCreateInput, Todo | null>,
      Viewer,
      TodoCreateInput,
      Todo | null
    >
  | Trigger<
      Todo,
      TodoBuilder<TodoCreateInput, Todo | null>,
      Viewer,
      TodoCreateInput,
      Todo | null
    >[]
)[];

export type CreateTodoActionObservers = Observer<
  Todo,
  TodoBuilder<TodoCreateInput, Todo | null>,
  Viewer,
  TodoCreateInput,
  Todo | null
>[];

export type CreateTodoActionValidators = Validator<
  Todo,
  TodoBuilder<TodoCreateInput, Todo | null>,
  Viewer,
  TodoCreateInput,
  Todo | null
>[];

export class CreateTodoActionBase
  implements
    Action<
      Todo,
      TodoBuilder<TodoCreateInput, Todo | null>,
      Viewer,
      TodoCreateInput,
      Todo | null
    >
{
  public readonly builder: TodoBuilder<TodoCreateInput, Todo | null>;
  public readonly viewer: Viewer;
  protected input: TodoCreateInput;

  constructor(viewer: Viewer, input: TodoCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new TodoBuilder(
      this.viewer,
      WriteOperation.Insert,
      this,
      null,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy<Todo, Viewer> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): CreateTodoActionTriggers {
    return [];
  }

  getObservers(): CreateTodoActionObservers {
    return [];
  }

  getValidators(): CreateTodoActionValidators {
    return [];
  }

  getInput(): TodoCreateInput {
    return this.input;
  }

  async changeset(): Promise<Changeset> {
    return this.builder.build();
  }

  async changesetWithOptions_BETA(
    options: ChangesetOptions,
  ): Promise<Changeset> {
    return this.builder.buildWithOptions_BETA(options);
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

  static create<T extends CreateTodoActionBase>(
    this: new (
      viewer: Viewer,
      input: TodoCreateInput,
    ) => T,
    viewer: Viewer,
    input: TodoCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
