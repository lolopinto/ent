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
import { mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { Comment } from "../../../../ent";
import CreateCommentAction, {
  CommentCreateInput,
} from "../../../../ent/comment/actions/create_comment_action";
import { CommentType } from "../../../resolvers";

interface customCommentCreateInput extends CommentCreateInput {
  authorID: string;
  articleID: string;
}

interface CommentCreatePayload {
  comment: Comment;
}

export const CommentCreateInputType = new GraphQLInputObjectType({
  name: "CommentCreateInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    authorID: {
      type: new GraphQLNonNull(GraphQLID),
    },
    body: {
      type: new GraphQLNonNull(GraphQLString),
    },
    articleID: {
      type: new GraphQLNonNull(GraphQLID),
    },
    articleType: {
      type: new GraphQLNonNull(GraphQLString),
    },
  }),
});

export const CommentCreatePayloadType = new GraphQLObjectType({
  name: "CommentCreatePayload",
  fields: (): GraphQLFieldConfigMap<CommentCreatePayload, RequestContext> => ({
    comment: {
      type: new GraphQLNonNull(CommentType),
    },
  }),
});

export const CommentCreateType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customCommentCreateInput }
> = {
  type: new GraphQLNonNull(CommentCreatePayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(CommentCreateInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<CommentCreatePayload> => {
    const comment = await CreateCommentAction.create(context.getViewer(), {
      authorID: mustDecodeIDFromGQLID(input.authorID),
      body: input.body,
      articleID: mustDecodeIDFromGQLID(input.articleID),
      articleType: input.articleType,
    }).saveX();
    return { comment: comment };
  },
};
