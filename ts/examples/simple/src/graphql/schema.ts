// TODO generate file
// TODO ensure there's mutation when generating this

import { GraphQLSchema } from "graphql";

import { QueryType } from "./resolvers/generated/query_type";
import { MutationType } from "./mutations/generated/mutation_type";

const schema = new GraphQLSchema({
  query: QueryType,
  mutation: MutationType,
});

export default schema;
