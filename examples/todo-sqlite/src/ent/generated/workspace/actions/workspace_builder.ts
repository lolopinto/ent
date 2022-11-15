// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { AssocEdgeInputOptions, Ent, ID, Viewer } from "@snowtop/ent";
import {
  Action,
  Builder,
  Changeset,
  Orchestrator,
  WriteOperation,
  saveBuilder,
  saveBuilderX,
} from "@snowtop/ent/action";
import { Account, Workspace } from "src/ent/";
import { workspaceLoaderInfo } from "src/ent/generated/loaders";
import { TodoContainerBuilder } from "src/ent/generated/mixins/todo_container/actions/todo_container_builder";
import { EdgeType, NodeType } from "src/ent/generated/types";
import schema from "src/schema/workspace_schema";

export interface WorkspaceInput {
  deletedAt?: Date | null;
  name?: string;
  slug?: string;
  // allow other properties. useful for action-only fields
  [x: string]: any;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

class Base {
  // @ts-ignore not assigning. need for Mixin
  orchestrator: Orchestrator<Workspace, any, Viewer>;

  constructor() {}

  isBuilder<T extends Ent>(
    node: ID | T | Builder<T, any>,
  ): node is Builder<T, any> {
    return (node as Builder<T, any>).placeholderID !== undefined;
  }
}

type MaybeNull<T extends Ent> = T | null;
type TMaybleNullableEnt<T extends Ent> = T | MaybeNull<T>;

export class WorkspaceBuilder<
    TInput extends WorkspaceInput = WorkspaceInput,
    TExistingEnt extends TMaybleNullableEnt<Workspace> = Workspace | null,
  >
  extends TodoContainerBuilder(Base)
  implements Builder<Workspace, Viewer, TExistingEnt>
{
  orchestrator: Orchestrator<Workspace, TInput, Viewer, TExistingEnt>;
  readonly placeholderID: ID;
  readonly ent = Workspace;
  readonly nodeType = NodeType.Workspace;
  private input: TInput;
  private m: Map<string, any> = new Map();

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: Action<
      Workspace,
      Builder<Workspace, Viewer, TExistingEnt>,
      Viewer,
      TInput,
      TExistingEnt
    >,
    public readonly existingEnt: TExistingEnt,
  ) {
    super();
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-Workspace`;
    this.input = action.getInput();
    const updateInput = (d: WorkspaceInput) =>
      this.updateInput.apply(this, [d]);

    this.orchestrator = new Orchestrator({
      viewer,
      operation: this.operation,
      tableName: "workspaces",
      key: "id",
      loaderOptions: Workspace.loaderOptions(),
      builder: this,
      action,
      schema,
      editedFields: () => this.getEditedFields.apply(this),
      updateInput,
      fieldInfo: workspaceLoaderInfo.fieldInfo,
    });
  }

  getInput(): TInput {
    return this.input;
  }

  updateInput(input: WorkspaceInput) {
    // input.viewerCreatorID default value is being set, also set inverseEdge
    if (input.viewerCreatorID !== undefined) {
      if (input.viewerCreatorID) {
        this.orchestrator.addInboundEdge(
          input.viewerCreatorID,
          EdgeType.AccountToCreatedWorkspaces,
          NodeType.Account,
        );
      }
      if (
        this.existingEnt &&
        this.existingEnt.viewerCreatorID &&
        this.existingEnt.viewerCreatorID !== input.viewerCreatorID
      ) {
        this.orchestrator.removeInboundEdge(
          this.existingEnt.viewerCreatorID,
          EdgeType.AccountToCreatedWorkspaces,
        );
      }
    }
    // override input
    this.input = {
      ...this.input,
      ...input,
    };
  }

  deleteInputKey(key: keyof WorkspaceInput) {
    delete this.input[key];
  }

  // store data in Builder that can be retrieved by another validator, trigger, observer later in the action
  storeData(k: string, v: any) {
    this.m.set(k, v);
  }

  // retrieve data stored in this Builder with key
  getStoredData(k: string) {
    return this.m.get(k);
  }

  // this returns the id of the existing ent or the id of the ent that's being created
  async getEntID() {
    if (this.existingEnt) {
      return this.existingEnt.id;
    }
    const edited = await this.orchestrator.getEditedData();
    if (!edited.id) {
      throw new Error(
        `couldn't get the id field. should have been set by 'defaultValueOnCreate'`,
      );
    }
    return edited.id;
  }
  // this gets the inputs that have been written for a given edgeType and operation
  // WriteOperation.Insert for adding an edge and WriteOperation.Delete for deleting an edge
  getEdgeInputData(edgeType: EdgeType, op: WriteOperation) {
    return this.orchestrator.getInputEdges(edgeType, op);
  }

  clearInputEdges(edgeType: EdgeType, op: WriteOperation, id?: ID) {
    this.orchestrator.clearInputEdges(edgeType, op, id);
  }

  addMember(...nodes: (ID | Account | Builder<Account, any>)[]): this {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addMemberID(node);
      } else if (typeof node === "object") {
        this.addMemberID(node.id);
      } else {
        this.addMemberID(node);
      }
    }
    return this;
  }

  addMemberID(
    id: ID | Builder<Account, any>,
    options?: AssocEdgeInputOptions,
  ): this {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.WorkspaceToMembers,
      NodeType.Account,
      options,
    );
    return this;
  }

  removeMember(...nodes: (ID | Account)[]): this {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.WorkspaceToMembers,
        );
      } else {
        this.orchestrator.removeOutboundEdge(node, EdgeType.WorkspaceToMembers);
      }
    }
    return this;
  }

  async build(): Promise<Changeset> {
    return this.orchestrator.build();
  }

  async valid(): Promise<boolean> {
    return this.orchestrator.valid();
  }

  async validX(): Promise<void> {
    return this.orchestrator.validX();
  }

  async save(): Promise<void> {
    await saveBuilder(this);
  }

  async saveX(): Promise<void> {
    await saveBuilderX(this);
  }

  async editedEnt(): Promise<Workspace | null> {
    return this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<Workspace> {
    return this.orchestrator.editedEntX();
  }

  private async getEditedFields(): Promise<Map<string, any>> {
    const input = this.input;

    const result = new Map<string, any>();

    const addField = function (key: string, value: any) {
      if (value !== undefined) {
        result.set(key, value);
      }
    };
    addField("deleted_at", input.deletedAt);
    addField("name", input.name);
    addField("slug", input.slug);
    return result;
  }

  isBuilder<T extends Ent>(
    node: ID | T | Builder<T, any>,
  ): node is Builder<T, any> {
    return (node as Builder<T, any>).placeholderID !== undefined;
  }

  // get value of deleted_at. Retrieves it from the input if specified or takes it from existingEnt
  getNewDeletedAtValue(): Date | null | undefined {
    return this.input.deletedAt;
  }

  // get value of name. Retrieves it from the input if specified or takes it from existingEnt
  getNewNameValue(): string {
    if (this.input.name !== undefined) {
      return this.input.name;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `name` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.name;
  }

  // get value of slug. Retrieves it from the input if specified or takes it from existingEnt
  getNewSlugValue(): string {
    if (this.input.slug !== undefined) {
      return this.input.slug;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `slug` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.slug;
  }
}
