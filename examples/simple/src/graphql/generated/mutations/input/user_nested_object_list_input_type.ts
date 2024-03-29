/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
} from "graphql";
import { IntEnumUsedInListType, ResponseTypeType } from "../../../resolvers";

const UserNestedNestedObjectListInputType = new GraphQLInputObjectType({
  name: "UserNestedNestedObjectListInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    int: {
      type: new GraphQLNonNull(GraphQLInt),
    },
  }),
});

export const UserNestedObjectListInputType = new GraphQLInputObjectType({
  name: "UserNestedObjectListInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    type: {
      type: new GraphQLNonNull(GraphQLString),
    },
    enum: {
      type: new GraphQLNonNull(ResponseTypeType),
    },
    objects: {
      type: new GraphQLNonNull(
        new GraphQLList(
          new GraphQLNonNull(UserNestedNestedObjectListInputType),
        ),
      ),
    },
    enumList: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(IntEnumUsedInListType)),
      ),
    },
  }),
});
