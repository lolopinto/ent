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
import { Account, Tag, Todo } from "src/ent/";
import { EdgeType, NodeType } from "src/ent/generated/const";
import schema from "src/schema/tag";

export interface TagInput {
  displayName?: string;
  canonicalName?: string;
  ownerID?: ID | Builder<Account>;
}

export interface TagAction extends Action<Tag> {
  getInput(): TagInput;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

export class TagBuilder implements Builder<Tag> {
  orchestrator: Orchestrator<Tag>;
  readonly placeholderID: ID;
  readonly ent = Tag;
  readonly nodeType = NodeType.Tag;
  private input: TagInput;
  private m: Map<string, any> = new Map();

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: TagAction,
    public readonly existingEnt?: Tag | undefined,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-Tag`;
    this.input = action.getInput();
    const updateInput = (d: TagInput) => this.updateInput.apply(this, [d]);

    this.orchestrator = new Orchestrator({
      viewer,
      operation: this.operation,
      tableName: "tags",
      key: "id",
      loaderOptions: Tag.loaderOptions(),
      builder: this,
      action,
      schema,
      editedFields: () => this.getEditedFields.apply(this),
      updateInput,
    });
  }

  getInput(): TagInput {
    return this.input;
  }

  updateInput(input: TagInput) {
    // override input
    this.input = {
      ...this.input,
      ...input,
    };
  }

  // store data in Builder that can be retrieved by another validator, trigger, observer later in the action
  storeData(k: string, v: any) {
    this.m.set(k, v);
  }

  // retrieve data stored in this Builder with key
  getStoredData(k: string) {
    return this.m.get(k);
  }

  // this gets the inputs that have been written for a given edgeType and operation
  // WriteOperation.Insert for adding an edge and WriteOperation.Delete for deleting an edge
  getEdgeInputData(edgeType: EdgeType, op: WriteOperation) {
    return this.orchestrator.getInputEdges(edgeType, op);
  }

  clearInputEdges(edgeType: EdgeType, op: WriteOperation, id?: ID) {
    this.orchestrator.clearInputEdges(edgeType, op, id);
  }

  addTodo(...nodes: (ID | Todo | Builder<Todo>)[]): TagBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addTodoID(node);
      } else if (typeof node === "object") {
        this.addTodoID(node.id);
      } else {
        this.addTodoID(node);
      }
    }
    return this;
  }

  addTodoID(
    id: ID | Builder<Todo>,
    options?: AssocEdgeInputOptions,
  ): TagBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.TagToTodos,
      NodeType.Todo,
      options,
    );
    return this;
  }

  removeTodo(...nodes: (ID | Todo)[]): TagBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(node.id, EdgeType.TagToTodos);
      } else {
        this.orchestrator.removeOutboundEdge(node, EdgeType.TagToTodos);
      }
    }
    return this;
  }

  async build(): Promise<Changeset<Tag>> {
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

  async editedEnt(): Promise<Tag | null> {
    return this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<Tag> {
    return this.orchestrator.editedEntX();
  }

  private getEditedFields(): Map<string, any> {
    const fields = this.input;

    const result = new Map<string, any>();

    const addField = function (key: string, value: any) {
      if (value !== undefined) {
        result.set(key, value);
      }
    };
    addField("DisplayName", fields.displayName);
    addField("canonicalName", fields.canonicalName);
    addField("ownerID", fields.ownerID);
    return result;
  }

  isBuilder(node: ID | Ent | Builder<Ent>): node is Builder<Ent> {
    return (node as Builder<Ent>).placeholderID !== undefined;
  }

  // get value of DisplayName. Retrieves it from the input if specified or takes it from existingEnt
  getNewDisplayNameValue(): string | undefined {
    if (this.input.displayName !== undefined) {
      return this.input.displayName;
    }
    return this.existingEnt?.displayName;
  }

  // get value of canonicalName. Retrieves it from the input if specified or takes it from existingEnt
  getNewCanonicalNameValue(): string | undefined {
    if (this.input.canonicalName !== undefined) {
      return this.input.canonicalName;
    }
    return this.existingEnt?.canonicalName;
  }

  // get value of ownerID. Retrieves it from the input if specified or takes it from existingEnt
  getNewOwnerIDValue(): ID | Builder<Account> | undefined {
    if (this.input.ownerID !== undefined) {
      return this.input.ownerID;
    }
    return this.existingEnt?.ownerID;
  }
}
