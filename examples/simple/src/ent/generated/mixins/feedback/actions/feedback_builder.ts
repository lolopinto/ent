/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { AssocEdgeInputOptions, Ent, ID } from "@snowtop/ent";
import { Builder, Orchestrator } from "@snowtop/ent/action";
import { EdgeType, NodeType } from "../../../types";
import { Comment, IFeedback, User } from "../../../../internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../../../viewer/viewer";

export interface IFeedbackBuilder<T extends IFeedback> {
  addComment(...nodes: (ID | Comment | Builder<Comment, any>)[]): this;
  addCommentID(
    id: ID | Builder<Comment, any>,
    options?: AssocEdgeInputOptions,
  ): this;
  removeComment(...nodes: (ID | Comment)[]): this;

  addLiker(...nodes: (ID | User | Builder<User, any>)[]): this;
  addLikerID(
    id: ID | Builder<User, any>,
    options?: AssocEdgeInputOptions,
  ): this;
  removeLiker(...nodes: (ID | User)[]): this;
}

// come back
type Constructor<
  T extends IFeedback<ExampleViewerAlias> = IFeedback<ExampleViewerAlias>,
> = new (
  ...args: any[]
) => T;

interface BuilderConstructor<T extends IFeedback<ExampleViewerAlias>, C = {}> {
  orchestrator: Orchestrator<T, any, ExampleViewerAlias>;
  isBuilder<T extends Ent>(
    node: ID | T | Builder<T, any>,
  ): node is Builder<T, any>;
}

export type FeedbackBuilderIsh<T extends IFeedback<ExampleViewerAlias>> =
  Constructor<
    // @ts-ignore TODO fix
    BuilderConstructor<T>
  >;

export function FeedbackBuilder<
  TEnt extends IFeedback<ExampleViewerAlias>,
  TBase extends FeedbackBuilderIsh<TEnt>,
>(BaseClass: TBase) {
  return class FeedbackBuilder
    extends BaseClass
    implements IFeedbackBuilder<TEnt>
  {
    constructor(...args: any[]) {
      super(...args);
    }

    addComment(...nodes: (ID | Comment | Builder<Comment, any>)[]): this {
      for (const node of nodes) {
        if (this.isBuilder(node)) {
          this.addCommentID(node);
        } else if (typeof node === "object") {
          this.addCommentID(node.id);
        } else {
          this.addCommentID(node);
        }
      }
      return this;
    }

    addCommentID(
      id: ID | Builder<Comment, any>,
      options?: AssocEdgeInputOptions,
    ): this {
      this.orchestrator.addOutboundEdge(
        id,
        EdgeType.ObjectToComments,
        NodeType.Comment,
        options,
      );
      return this;
    }

    removeComment(...nodes: (ID | Comment)[]): this {
      for (const node of nodes) {
        if (typeof node === "object") {
          this.orchestrator.removeOutboundEdge(
            node.id,
            EdgeType.ObjectToComments,
          );
        } else {
          this.orchestrator.removeOutboundEdge(node, EdgeType.ObjectToComments);
        }
      }
      return this;
    }

    addLiker(...nodes: (ID | User | Builder<User, any>)[]): this {
      for (const node of nodes) {
        if (this.isBuilder(node)) {
          this.addLikerID(node);
        } else if (typeof node === "object") {
          this.addLikerID(node.id);
        } else {
          this.addLikerID(node);
        }
      }
      return this;
    }

    addLikerID(
      id: ID | Builder<User, any>,
      options?: AssocEdgeInputOptions,
    ): this {
      this.orchestrator.addOutboundEdge(
        id,
        EdgeType.ObjectToLikers,
        NodeType.User,
        options,
      );
      return this;
    }

    removeLiker(...nodes: (ID | User)[]): this {
      for (const node of nodes) {
        if (typeof node === "object") {
          this.orchestrator.removeOutboundEdge(
            node.id,
            EdgeType.ObjectToLikers,
          );
        } else {
          this.orchestrator.removeOutboundEdge(node, EdgeType.ObjectToLikers);
        }
      }
      return this;
    }
  };
}
