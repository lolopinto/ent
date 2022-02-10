/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLBoolean,
  GraphQLFieldConfigMap,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  GraphQLUnionType,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { GraphQLTime } from "@snowtop/ent/graphql";
import {
  CatType,
  DogType,
  RabbitType,
  UserNestedNestedObject,
  UserNestedObject,
  UserSuperNestedObject,
} from "../../../ent";
import {
  CatBreedType,
  DogBreedGroupType,
  DogBreedType,
  EnumType,
  NestedEnumType,
  NestedNestedEnumType,
  RabbitBreedType,
} from "../internal";

const UserNestedObjectType = new GraphQLObjectType({
  name: "UserNestedObject",
  fields: (): GraphQLFieldConfigMap<UserNestedObject, RequestContext> => ({
    nestedUuid: {
      type: GraphQLNonNull(GraphQLID),
    },
    nestedInt: {
      type: GraphQLNonNull(GraphQLInt),
    },
    nestedString: {
      type: GraphQLNonNull(GraphQLString),
    },
    nestedBool: {
      type: GraphQLNonNull(GraphQLBoolean),
    },
    nestedFloat: {
      type: GraphQLFloat,
    },
    nestedEnum: {
      type: GraphQLNonNull(NestedEnumType),
    },
    nestedStringList: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLString))),
    },
    nestedIntList: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLInt))),
    },
    nestedObj: {
      type: UserNestedNestedObjectType,
    },
  }),
});

const UserNestedNestedObjectType = new GraphQLObjectType({
  name: "UserNestedNestedObject",
  fields: (): GraphQLFieldConfigMap<
    UserNestedNestedObject,
    RequestContext
  > => ({
    nestedNestedUuid: {
      type: GraphQLNonNull(GraphQLID),
    },
    nestedNestedInt: {
      type: GraphQLNonNull(GraphQLInt),
    },
    nestedNestedString: {
      type: GraphQLNonNull(GraphQLString),
    },
    nestedNestedBool: {
      type: GraphQLBoolean,
    },
    nestedNestedFloat: {
      type: GraphQLNonNull(GraphQLFloat),
    },
    nestedNestedEnum: {
      type: GraphQLNonNull(NestedNestedEnumType),
    },
    nestedNestedStringList: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLString))),
    },
    nestedNestedIntList: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLInt))),
    },
  }),
});

const CatTypeType = new GraphQLObjectType({
  name: "CatType",
  fields: (): GraphQLFieldConfigMap<CatType, RequestContext> => ({
    name: {
      type: GraphQLNonNull(GraphQLString),
    },
    birthday: {
      type: GraphQLNonNull(GraphQLTime),
    },
    breed: {
      type: GraphQLNonNull(CatBreedType),
    },
    kitten: {
      type: GraphQLNonNull(GraphQLBoolean),
    },
  }),
});

const DogTypeType = new GraphQLObjectType({
  name: "DogType",
  fields: (): GraphQLFieldConfigMap<DogType, RequestContext> => ({
    name: {
      type: GraphQLNonNull(GraphQLString),
    },
    birthday: {
      type: GraphQLNonNull(GraphQLTime),
    },
    breed: {
      type: GraphQLNonNull(DogBreedType),
    },
    breedGroup: {
      type: GraphQLNonNull(DogBreedGroupType),
    },
    puppy: {
      type: GraphQLNonNull(GraphQLBoolean),
    },
  }),
});

const RabbitTypeType = new GraphQLObjectType({
  name: "RabbitType",
  fields: (): GraphQLFieldConfigMap<RabbitType, RequestContext> => ({
    name: {
      type: GraphQLNonNull(GraphQLString),
    },
    birthday: {
      type: GraphQLNonNull(GraphQLTime),
    },
    breed: {
      type: GraphQLNonNull(RabbitBreedType),
    },
  }),
});

const PetUnionTypeType = new GraphQLUnionType({
  name: "PetUnionType",
  types: [CatTypeType, DogTypeType, RabbitTypeType],
});

export const UserSuperNestedObjectType = new GraphQLObjectType({
  name: "UserSuperNestedObject",
  fields: (): GraphQLFieldConfigMap<UserSuperNestedObject, RequestContext> => ({
    uuid: {
      type: GraphQLNonNull(GraphQLID),
    },
    int: {
      type: GraphQLNonNull(GraphQLInt),
    },
    string: {
      type: GraphQLNonNull(GraphQLString),
    },
    bool: {
      type: GraphQLNonNull(GraphQLBoolean),
    },
    float: {
      type: GraphQLNonNull(GraphQLFloat),
    },
    enum: {
      type: GraphQLNonNull(EnumType),
    },
    stringList: {
      type: GraphQLList(GraphQLNonNull(GraphQLString)),
    },
    intList: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLInt))),
    },
    obj: {
      type: UserNestedObjectType,
    },
    union: {
      type: PetUnionTypeType,
    },
  }),
});
