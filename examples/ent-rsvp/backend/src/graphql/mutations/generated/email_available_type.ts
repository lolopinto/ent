// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { AuthResolver } from "../auth/auth";
import {
  GraphQLBoolean,
  GraphQLFieldConfig,
  GraphQLNonNull,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@lolopinto/ent";

export const EmailAvailableType: GraphQLFieldConfig<
  undefined,
  RequestContext
> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    email: {
      description: "",
      type: GraphQLNonNull(GraphQLString),
    },
  },
  resolve: async (
    _source,
    { email },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ) => {
    const r = new AuthResolver();
    return r.emailAvailableMutation(email);
  },
};
