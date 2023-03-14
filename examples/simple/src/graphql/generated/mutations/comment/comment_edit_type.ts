/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import {
  mustDecodeIDFromGQLID,
  mustDecodeNullableIDFromGQLID,
} from "@snowtop/ent/graphql";
import { Comment } from "../../../../ent";
import EditCommentAction, {
  CommentEditInput,
} from "../../../../ent/comment/actions/edit_comment_action";
import { CommentType } from "../../../resolvers";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

interface customCommentEditInput extends CommentEditInput {
  id: string;
  articleID?: string;
  stickerID?: string;
}

interface CommentEditPayload {
  comment: Comment;
}

export const CommentEditInputType = new GraphQLInputObjectType({
  name: "CommentEditInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      description: "id of Comment",
      type: new GraphQLNonNull(GraphQLID),
    },
    body: {
      type: GraphQLString,
    },
    articleID: {
      type: GraphQLID,
    },
    articleType: {
      type: GraphQLString,
    },
    stickerID: {
      type: GraphQLID,
    },
    stickerType: {
      type: GraphQLString,
    },
  }),
});

export const CommentEditPayloadType = new GraphQLObjectType({
  name: "CommentEditPayload",
  fields: (): GraphQLFieldConfigMap<
    CommentEditPayload,
    RequestContext<ExampleViewerAlias>
  > => ({
    comment: {
      type: new GraphQLNonNull(CommentType),
    },
  }),
});

export const CommentEditType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  { [input: string]: customCommentEditInput }
> = {
  type: new GraphQLNonNull(CommentEditPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(CommentEditInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<ExampleViewerAlias>,
    _info: GraphQLResolveInfo,
  ): Promise<CommentEditPayload> => {
    const comment = await EditCommentAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.id),
      {
        body: input.body,
        articleID: mustDecodeNullableIDFromGQLID(input.articleID),
        articleType: input.articleType,
        stickerID: mustDecodeNullableIDFromGQLID(input.stickerID),
        stickerType: input.stickerType,
      },
    );
    return { comment: comment };
  },
};