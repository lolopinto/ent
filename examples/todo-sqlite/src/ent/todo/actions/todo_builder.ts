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
import { EdgeType, NodeType } from "src/ent/const";
import schema from "src/schema/todo";

export interface TodoInput {
  text?: string;
  completed?: boolean;
  creatorID?: ID | Builder<Account>;
}

export interface TodoAction extends Action<Todo> {
  getInput(): TodoInput;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

export class TodoBuilder implements Builder<Todo> {
  orchestrator: Orchestrator<Todo>;
  readonly placeholderID: ID;
  readonly ent = Todo;
  private input: TodoInput;

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: TodoAction,
    public readonly existingEnt?: Todo | undefined,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-Todo`;
    this.input = action.getInput();

    this.orchestrator = new Orchestrator({
      viewer: viewer,
      operation: this.operation,
      tableName: "todos",
      key: "id",
      loaderOptions: Todo.loaderOptions(),
      builder: this,
      action: action,
      schema: schema,
      editedFields: () => {
        return this.getEditedFields.apply(this);
      },
    });
  }

  getInput(): TodoInput {
    return this.input;
  }

  updateInput(input: TodoInput) {
    // override input
    this.input = {
      ...this.input,
      ...input,
    };
  }

  // this gets the inputs that have been written for a given edgeType and operation
  // WriteOperation.Insert for adding an edge and WriteOperation.Delete for deleting an edge
  getEdgeInputData(edgeType: EdgeType, op: WriteOperation) {
    return this.orchestrator.getInputEdges(edgeType, op);
  }

  clearInputEdges(edgeType: EdgeType, op: WriteOperation, id?: ID) {
    this.orchestrator.clearInputEdges(edgeType, op, id);
  }
  addTag(...ids: ID[]): TodoBuilder;
  addTag(...nodes: Tag[]): TodoBuilder;
  addTag(...nodes: Builder<Tag>[]): TodoBuilder;
  addTag(...nodes: ID[] | Tag[] | Builder<Tag>[]): TodoBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addTagID(node);
      } else if (typeof node === "object") {
        this.addTagID(node.id);
      } else {
        this.addTagID(node);
      }
    }
    return this;
  }

  addTagID(
    id: ID | Builder<Tag>,
    options?: AssocEdgeInputOptions,
  ): TodoBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.TodoToTags,
      NodeType.Tag,
      options,
    );
    return this;
  }

  removeTag(...ids: ID[]): TodoBuilder;
  removeTag(...nodes: Tag[]): TodoBuilder;
  removeTag(...nodes: ID[] | Tag[]): TodoBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(node.id, EdgeType.TodoToTags);
      } else {
        this.orchestrator.removeOutboundEdge(node, EdgeType.TodoToTags);
      }
    }
    return this;
  }

  async build(): Promise<Changeset<Todo>> {
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

  async editedEnt(): Promise<Todo | null> {
    return await this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<Todo> {
    return await this.orchestrator.editedEntX();
  }

  private getEditedFields(): Map<string, any> {
    const fields = this.input;

    let result = new Map<string, any>();

    const addField = function (key: string, value: any) {
      if (value !== undefined) {
        result.set(key, value);
      }
    };
    addField("Text", fields.text);
    addField("Completed", fields.completed);
    addField("creatorID", fields.creatorID);
    return result;
  }

  isBuilder(node: ID | Ent | Builder<Ent>): node is Builder<Ent> {
    return (node as Builder<Ent>).placeholderID !== undefined;
  }

  // get value of Text. Retrieves it from the input if specified or takes it from existingEnt
  getNewTextValue(): string | undefined {
    return this.input.text || this.existingEnt?.text;
  }

  // get value of Completed. Retrieves it from the input if specified or takes it from existingEnt
  getNewCompletedValue(): boolean | undefined {
    return this.input.completed || this.existingEnt?.completed;
  }

  // get value of creatorID. Retrieves it from the input if specified or takes it from existingEnt
  getNewCreatorIDValue(): ID | Builder<Account> | undefined {
    return this.input.creatorID || this.existingEnt?.creatorID;
  }
}
