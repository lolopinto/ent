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
import { File } from "../../../../ent";
import CreateFileAction, {
  FileCreateInput,
} from "../../../../ent/file/actions/create_file_action";
import { FileType } from "../../../resolvers";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

interface customFileCreateInput extends FileCreateInput {
  creatorId: string;
}

interface FileCreatePayload {
  file: File;
}

export const FileCreateInputType = new GraphQLInputObjectType({
  name: "FileCreateInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    name: {
      type: new GraphQLNonNull(GraphQLString),
    },
    path: {
      type: new GraphQLNonNull(GraphQLString),
    },
    creatorId: {
      type: new GraphQLNonNull(GraphQLID),
    },
  }),
});

export const FileCreatePayloadType = new GraphQLObjectType({
  name: "FileCreatePayload",
  fields: (): GraphQLFieldConfigMap<
    FileCreatePayload,
    RequestContext<ExampleViewerAlias>
  > => ({
    file: {
      type: new GraphQLNonNull(FileType),
    },
  }),
});

export const FileCreateType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  { [input: string]: customFileCreateInput }
> = {
  type: new GraphQLNonNull(FileCreatePayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(FileCreateInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<ExampleViewerAlias>,
    _info: GraphQLResolveInfo,
  ): Promise<FileCreatePayload> => {
    const file = await CreateFileAction.create(context.getViewer(), {
      name: input.name,
      path: input.path,
      creatorId: mustDecodeIDFromGQLID(input.creatorId.toString()),
    }).saveX();
    return { file: file };
  },
};
