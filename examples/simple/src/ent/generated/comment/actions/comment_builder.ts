/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { AssocEdgeInputOptions, Ent, ID } from "@snowtop/ent";
import {
  Action,
  Builder,
  Changeset,
  Orchestrator,
  OrchestratorOptions,
  WriteOperation,
  saveBuilder,
  saveBuilderX,
} from "@snowtop/ent/action";
import { Comment, User } from "../../..";
import { commentLoaderInfo } from "../../loaders";
import { EdgeType, NodeType } from "../../types";
import schema from "../../../../schema/comment_schema";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export interface CommentInput {
  authorID?: ID | Builder<User, ExampleViewerAlias>;
  body?: string;
  articleID?: ID | Builder<Ent<ExampleViewerAlias>, ExampleViewerAlias>;
  articleType?: string;
  stickerID?: ID | null | Builder<Ent<ExampleViewerAlias>, ExampleViewerAlias>;
  stickerType?: string | null;
  // allow other properties. useful for action-only fields
  [x: string]: any;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

type MaybeNull<T extends Ent> = T | null;
type TMaybleNullableEnt<T extends Ent> = T | MaybeNull<T>;

export class CommentBuilder<
  TInput extends CommentInput = CommentInput,
  TExistingEnt extends TMaybleNullableEnt<Comment> = Comment | null,
> implements Builder<Comment, ExampleViewerAlias, TExistingEnt>
{
  orchestrator: Orchestrator<Comment, TInput, ExampleViewerAlias, TExistingEnt>;
  readonly placeholderID: ID;
  readonly ent = Comment;
  readonly nodeType = NodeType.Comment;
  private input: TInput;
  private m: Map<string, any> = new Map();

  public constructor(
    public readonly viewer: ExampleViewerAlias,
    public readonly operation: WriteOperation,
    action: Action<
      Comment,
      Builder<Comment, ExampleViewerAlias, TExistingEnt>,
      ExampleViewerAlias,
      TInput,
      TExistingEnt
    >,
    public readonly existingEnt: TExistingEnt,
    opts?: Partial<
      OrchestratorOptions<Comment, TInput, ExampleViewerAlias, TExistingEnt>
    >,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-Comment`;
    this.input = action.getInput();
    const updateInput = (d: CommentInput) => this.updateInput.apply(this, [d]);

    this.orchestrator = new Orchestrator({
      viewer,
      operation: this.operation,
      tableName: "comments",
      key: "id",
      loaderOptions: Comment.loaderOptions(),
      builder: this,
      action,
      schema,
      editedFields: () => this.getEditedFields.apply(this),
      updateInput,
      fieldInfo: commentLoaderInfo.fieldInfo,
      ...opts,
    });
  }

  getInput(): TInput {
    return this.input;
  }

  updateInput(input: CommentInput) {
    // override input
    this.input = {
      ...this.input,
      ...input,
    };
  }

  deleteInputKey(key: keyof CommentInput) {
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
  addPost(...nodes: (Ent | Builder<Ent, any>)[]): this {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.orchestrator.addOutboundEdge(
          node,
          EdgeType.CommentToPost,
          // nodeType will be gotten from Executor later
          "",
        );
      } else {
        this.orchestrator.addOutboundEdge(
          node.id,
          EdgeType.CommentToPost,
          node.nodeType,
        );
      }
    }
    return this;
  }

  addPostID(
    id: ID | Builder<Ent, any>,
    nodeType: NodeType,
    options?: AssocEdgeInputOptions,
  ): this {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.CommentToPost,
      nodeType,
      options,
    );
    return this;
  }

  removePost(...nodes: (ID | Ent)[]): this {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(node.id, EdgeType.CommentToPost);
      } else {
        this.orchestrator.removeOutboundEdge(node, EdgeType.CommentToPost);
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

  async editedEnt(): Promise<Comment | null> {
    return this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<Comment> {
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
    addField("AuthorID", input.authorID);
    addField("Body", input.body);
    addField("ArticleID", input.articleID);
    addField("ArticleType", input.articleType);
    addField("StickerID", input.stickerID);
    addField("StickerType", input.stickerType);
    return result;
  }

  isBuilder<T extends Ent>(
    node: ID | T | Builder<T, any>,
  ): node is Builder<T, any> {
    return (node as Builder<T, any>).placeholderID !== undefined;
  }

  // get value of AuthorID. Retrieves it from the input if specified or takes it from existingEnt
  getNewAuthorIDValue(): ID | Builder<User, ExampleViewerAlias> {
    if (this.input.authorID !== undefined) {
      return this.input.authorID;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `authorID` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.authorID;
  }

  // get value of Body. Retrieves it from the input if specified or takes it from existingEnt
  getNewBodyValue(): string {
    if (this.input.body !== undefined) {
      return this.input.body;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `body` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.body;
  }

  // get value of ArticleID. Retrieves it from the input if specified or takes it from existingEnt
  getNewArticleIDValue():
    | ID
    | Builder<Ent<ExampleViewerAlias>, ExampleViewerAlias> {
    if (this.input.articleID !== undefined) {
      return this.input.articleID;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `articleID` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.articleID;
  }

  // get value of ArticleType. Retrieves it from the input if specified or takes it from existingEnt
  getNewArticleTypeValue(): string {
    if (this.input.articleType !== undefined) {
      return this.input.articleType;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `articleType` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.articleType;
  }

  // get value of StickerID. Retrieves it from the input if specified or takes it from existingEnt
  getNewStickerIDValue():
    | ID
    | null
    | Builder<Ent<ExampleViewerAlias>, ExampleViewerAlias> {
    if (this.input.stickerID !== undefined) {
      return this.input.stickerID;
    }

    return this.existingEnt?.stickerID ?? null;
  }

  // get value of StickerType. Retrieves it from the input if specified or takes it from existingEnt
  getNewStickerTypeValue(): string | null {
    if (this.input.stickerType !== undefined) {
      return this.input.stickerType;
    }

    return this.existingEnt?.stickerType ?? null;
  }
}
