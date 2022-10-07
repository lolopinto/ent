/**
 * Copyright whaa whaa
 */

import { ID } from "@snowtop/ent";

export enum SuperNestedObjectEnum {
  Yes = "yes",
  No = "no",
  Maybe = "maybe",
}

export enum ObjNestedEnum {
  Yes = "yes",
  No = "no",
  Maybe = "maybe",
}

export enum NestedObjNestedNestedEnum {
  Yes = "yes",
  No = "no",
  Maybe = "maybe",
}

export enum CatBreed {
  Bengal = "bengal",
  Burmese = "burmese",
  Himalayan = "himalayan",
  Somali = "somali",
  Persian = "persian",
  Siamese = "siamese",
  Tabby = "tabby",
  Other = "other",
}

export enum DogBreed {
  GermanShepherd = "german_shepherd",
  Labrador = "labrador",
  Pomerian = "pomerian",
  SiberianHusky = "siberian_husky",
  Poodle = "poodle",
  GoldenRetriever = "golden_retriever",
  Other = "other",
}

export enum DogBreedGroup {
  Sporting = "sporting",
  Hound = "hound",
  Working = "working",
  Terrier = "terrier",
  Toy = "toy",
  NonSporting = "non_sporting",
  Herding = "herding",
}

export enum RabbitBreed {
  AmericanRabbit = "american_rabbit",
  AmericanChincilla = "american_chincilla",
  AmericanFuzzyLop = "american_fuzzy_lop",
  AmericanSable = "american_sable",
  ArgenteBrun = "argente_brun",
  BelgianHare = "belgian_hare",
  Beveren = "beveren",
  Other = "other",
}

export interface UserNestedObject {
  nestedUuid: ID;
  nestedInt: number;
  nestedString: string;
  nestedBool: boolean;
  nestedFloat?: number | null;
  nestedEnum: ObjNestedEnum;
  nestedStringList: string[];
  nestedIntList: number[];
  nestedObj?: UserNestedNestedObject | null;
}

export function convertUserNestedObject(input: any): UserNestedObject {
  return {
    nestedUuid: input.nested_uuid,
    nestedInt: input.nested_int,
    nestedString: input.nested_string,
    nestedBool: input.nested_bool,
    nestedFloat: input.nested_float,
    nestedEnum: input.nested_enum,
    nestedStringList: input.nested_string_list,
    nestedIntList: input.nested_int_list,
    nestedObj: convertNullableUserNestedNestedObject(input.nested_obj),
  };
}

export function convertNullableUserNestedObject(
  input: any,
): UserNestedObject | null {
  if (input === undefined || input === null) {
    return null;
  }
  return convertUserNestedObject(input);
}

export interface UserNestedNestedObject {
  nestedNestedUuid: ID;
  nestedNestedInt: number;
  nestedNestedString: string;
  nestedNestedBool?: boolean | null;
  nestedNestedFloat: number;
  nestedNestedEnum: NestedObjNestedNestedEnum;
  nestedNestedStringList: string[];
  nestedNestedIntList: number[];
}

export function convertUserNestedNestedObject(
  input: any,
): UserNestedNestedObject {
  return {
    nestedNestedUuid: input.nested_nested_uuid,
    nestedNestedInt: input.nested_nested_int,
    nestedNestedString: input.nested_nested_string,
    nestedNestedBool: input.nested_nested_bool,
    nestedNestedFloat: input.nested_nested_float,
    nestedNestedEnum: input.nested_nested_enum,
    nestedNestedStringList: input.nested_nested_string_list,
    nestedNestedIntList: input.nested_nested_int_list,
  };
}

export function convertNullableUserNestedNestedObject(
  input: any,
): UserNestedNestedObject | null {
  if (input === undefined || input === null) {
    return null;
  }
  return convertUserNestedNestedObject(input);
}

export interface CatType {
  name: string;
  birthday: Date;
  breed: CatBreed;
  kitten: boolean;
}

export interface DogType {
  name: string;
  birthday: Date;
  breed: DogBreed;
  breedGroup: DogBreedGroup;
  puppy: boolean;
}

export function convertDogType(input: any): DogType {
  return {
    name: input.name,
    birthday: input.birthday,
    breed: input.breed,
    breedGroup: input.breed_group,
    puppy: input.puppy,
  };
}

export function convertNullableDogType(input: any): DogType | null {
  if (input === undefined || input === null) {
    return null;
  }
  return convertDogType(input);
}

export interface RabbitType {
  name: string;
  birthday: Date;
  breed: RabbitBreed;
}

export type PetUnionType = CatType | DogType | RabbitType;

function convertPetUnionType(input: any): PetUnionType {
  if (input.kitten !== undefined) {
    // return convertCatType(input);
  }
  if (input.breed_group !== undefined) {
    return convertDogType(input);
  }
  return input;
  // return convertRabbitType(input);
}

function convertNullablePetUnionType(input: any): PetUnionType | null {
  if (input === null || input === undefined) {
    return null;
  }
  return convertPetUnionType(input);
}

export interface UserSuperNestedObject {
  uuid: ID;
  int: number;
  string: string;
  bool: boolean;
  float: number;
  enum: SuperNestedObjectEnum;
  stringList?: string[] | null;
  intList: number[];
  obj?: UserNestedObject | null;
  union?: PetUnionType | null;
}

export function convertUserSuperNestedObject(
  input: any,
): UserSuperNestedObject {
  return {
    uuid: input.uuid,
    int: input.int,
    string: input.string,
    bool: input.bool,
    float: input.float,
    enum: input.enum,
    stringList: input.string_list,
    intList: input.int_list,
    obj: convertNullableUserNestedObject(input.obj),
    union: convertNullablePetUnionType(input.union),
  };
}

export function convertNullableUserSuperNestedObject(
  input: any,
): UserSuperNestedObject | null {
  if (input === undefined || input === null) {
    return null;
  }
  return convertUserSuperNestedObject(input);
}
