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
import { Workspace } from "src/ent/";
import {
  WorkspaceBuilder,
  WorkspaceInput,
} from "src/ent/generated/workspace/actions/workspace_builder";

export type DeleteWorkspaceActionTriggers = (
  | Trigger<
      Workspace,
      WorkspaceBuilder<WorkspaceInput, Workspace>,
      Viewer,
      WorkspaceInput,
      Workspace
    >
  | Trigger<
      Workspace,
      WorkspaceBuilder<WorkspaceInput, Workspace>,
      Viewer,
      WorkspaceInput,
      Workspace
    >[]
)[];

export type DeleteWorkspaceActionObservers = Observer<
  Workspace,
  WorkspaceBuilder<WorkspaceInput, Workspace>,
  Viewer,
  WorkspaceInput,
  Workspace
>[];

export type DeleteWorkspaceActionValidators = Validator<
  Workspace,
  WorkspaceBuilder<WorkspaceInput, Workspace>,
  Viewer,
  WorkspaceInput,
  Workspace
>[];

export class DeleteWorkspaceActionBase
  implements
    Action<
      Workspace,
      WorkspaceBuilder<WorkspaceInput, Workspace>,
      Viewer,
      WorkspaceInput,
      Workspace
    >
{
  public readonly builder: WorkspaceBuilder<WorkspaceInput, Workspace>;
  public readonly viewer: Viewer;
  protected readonly workspace: Workspace;

  constructor(viewer: Viewer, workspace: Workspace) {
    this.viewer = viewer;
    this.builder = new WorkspaceBuilder(
      this.viewer,
      WriteOperation.Delete,
      this,
      workspace,
    );
    this.workspace = workspace;
  }

  getPrivacyPolicy(): PrivacyPolicy<Workspace, Viewer> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): DeleteWorkspaceActionTriggers {
    return [];
  }

  getObservers(): DeleteWorkspaceActionObservers {
    return [];
  }

  getValidators(): DeleteWorkspaceActionValidators {
    return [];
  }

  getInput(): WorkspaceInput {
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

  static create<T extends DeleteWorkspaceActionBase>(
    this: new (viewer: Viewer, workspace: Workspace) => T,
    viewer: Viewer,
    workspace: Workspace,
  ): T {
    return new this(viewer, workspace);
  }

  static async saveXFromID<T extends DeleteWorkspaceActionBase>(
    this: new (viewer: Viewer, workspace: Workspace) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<void> {
    const workspace = await Workspace.loadX(viewer, id);
    return new this(viewer, workspace).saveX();
  }
}
