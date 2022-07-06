// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { ID, RequestContext, Viewer } from "@snowtop/ent";
import { Tag } from "src/ent/";
import CreateTagAction, {
  TagCreateInput,
} from "src/ent/tag/actions/create_tag_action";
import { TagType } from "src/graphql/resolvers/";

interface customCreateTagInput
  extends Omit<TagCreateInput, "displayName" | "relatedTagIds"> {
  display_name: string;
  owner_id: string;
  related_tag_ids?: ID[] | null;
}

interface CreateTagPayload {
  tag: Tag;
}

export const CreateTagInputType = new GraphQLInputObjectType({
  name: "CreateTagInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    display_name: {
      type: new GraphQLNonNull(GraphQLString),
    },
    owner_id: {
      type: new GraphQLNonNull(GraphQLID),
    },
    related_tag_ids: {
      type: new GraphQLList(new GraphQLNonNull(GraphQLID)),
    },
  }),
});

export const CreateTagPayloadType = new GraphQLObjectType({
  name: "CreateTagPayload",
  fields: (): GraphQLFieldConfigMap<CreateTagPayload, RequestContext> => ({
    tag: {
      type: new GraphQLNonNull(TagType),
    },
  }),
});

export const CreateTagType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  { [input: string]: customCreateTagInput }
> = {
  type: new GraphQLNonNull(CreateTagPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(CreateTagInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<Viewer>,
    _info: GraphQLResolveInfo,
  ): Promise<CreateTagPayload> => {
    const tag = await CreateTagAction.create(context.getViewer(), {
      displayName: input.display_name,
      ownerID: input.owner_id,
      relatedTagIds: input.related_tag_ids,
    }).saveX();
    return { tag: tag };
  },
};