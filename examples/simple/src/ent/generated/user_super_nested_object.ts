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

export interface RabbitType {
  name: string;
  birthday: Date;
  breed: RabbitBreed;
}

export type PetUnionType = CatType | DogType | RabbitType;

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
