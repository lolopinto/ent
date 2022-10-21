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
  Observer,
  Trigger,
  Validator,
  WriteOperation,
} from "@snowtop/ent/action";
import { Account, Workspace } from "src/ent/";
import { WorkspaceBuilder } from "src/ent/generated/workspace/actions/workspace_builder";

export interface WorkspaceEditInput {
  name?: string;
  creatorID?: ID | Builder<Account, Viewer>;
  slug?: string;
}

export type EditWorkspaceActionTriggers = (
  | Trigger<
      Workspace,
      WorkspaceBuilder<WorkspaceEditInput, Workspace>,
      Viewer,
      WorkspaceEditInput,
      Workspace
    >
  | Trigger<
      Workspace,
      WorkspaceBuilder<WorkspaceEditInput, Workspace>,
      Viewer,
      WorkspaceEditInput,
      Workspace
    >[]
)[];

export type EditWorkspaceActionObservers = Observer<
  Workspace,
  WorkspaceBuilder<WorkspaceEditInput, Workspace>,
  Viewer,
  WorkspaceEditInput,
  Workspace
>[];

export type EditWorkspaceActionValidators = Validator<
  Workspace,
  WorkspaceBuilder<WorkspaceEditInput, Workspace>,
  Viewer,
  WorkspaceEditInput,
  Workspace
>[];

export class EditWorkspaceActionBase
  implements
    Action<
      Workspace,
      WorkspaceBuilder<WorkspaceEditInput, Workspace>,
      Viewer,
      WorkspaceEditInput,
      Workspace
    >
{
  public readonly builder: WorkspaceBuilder<WorkspaceEditInput, Workspace>;
  public readonly viewer: Viewer;
  protected input: WorkspaceEditInput;
  protected readonly workspace: Workspace;

  constructor(viewer: Viewer, workspace: Workspace, input: WorkspaceEditInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new WorkspaceBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      workspace,
    );
    this.workspace = workspace;
  }

  getPrivacyPolicy(): PrivacyPolicy<Workspace, Viewer> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): EditWorkspaceActionTriggers {
    return [];
  }

  getObservers(): EditWorkspaceActionObservers {
    return [];
  }

  getValidators(): EditWorkspaceActionValidators {
    return [];
  }

  getInput(): WorkspaceEditInput {
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

  async save(): Promise<Workspace | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<Workspace> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends EditWorkspaceActionBase>(
    this: new (
      viewer: Viewer,
      workspace: Workspace,
      input: WorkspaceEditInput,
    ) => T,
    viewer: Viewer,
    workspace: Workspace,
    input: WorkspaceEditInput,
  ): T {
    return new this(viewer, workspace, input);
  }

  static async saveXFromID<T extends EditWorkspaceActionBase>(
    this: new (
      viewer: Viewer,
      workspace: Workspace,
      input: WorkspaceEditInput,
    ) => T,
    viewer: Viewer,
    id: ID,
    input: WorkspaceEditInput,
  ): Promise<Workspace> {
    const workspace = await Workspace.loadX(viewer, id);
    return new this(viewer, workspace, input).saveX();
  }
}