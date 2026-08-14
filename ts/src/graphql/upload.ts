import type { Readable } from "stream";
import type { GraphQLScalarType } from "graphql";

import GraphQLUploadImport from "graphql-upload/GraphQLUpload.js";
import graphqlUploadExpressImport from "graphql-upload/graphqlUploadExpress.js";

export interface FileUpload {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream(): Readable;
}

export interface GraphQLUploadExpressOptions {
  maxFieldSize?: number;
  maxFileSize?: number;
  maxFiles?: number;
  [key: string]: unknown;
}

export const GraphQLUpload = GraphQLUploadImport as GraphQLScalarType;
export const graphqlUploadExpress = graphqlUploadExpressImport as (
  options?: GraphQLUploadExpressOptions,
) => any;
