/**
 * Copyright whaa whaa
 */

import { ID } from "@snowtop/ent";

export enum Enum {
  Yes = "yes",
  No = "no",
  Maybe = "maybe",
}

export enum NestedEnum {
  Yes = "yes",
  No = "no",
  Maybe = "maybe",
}

export enum NestedNestedEnum {
  Yes = "yes",
  No = "no",
  Maybe = "maybe",
}

export interface UserNestedObject {
  nestedUuid?: ID;
  nestedInt?: number;
  nestedString?: string;
  nestedBool?: boolean;
  nestedFloat?: number;
  nestedEnum?: NestedEnum;
  nestedStringList?: string[];
  nestedIntList?: number[];
  nestedObj?: UserNestedNestedObject | null;
}

export interface UserNestedNestedObject {
  nestedNestedUuid?: ID;
  nestedNestedInt?: number;
  nestedNestedString?: string;
  nestedNestedBool?: boolean;
  nestedNestedFloat?: number;
  nestedNestedEnum?: NestedNestedEnum;
  nestedNestedStringList?: string[];
  nestedNestedIntList?: number[];
}

export interface UserSuperNestedObject {
  uuid?: ID;
  int?: number;
  string?: string;
  bool?: boolean;
  float?: number;
  enum?: Enum;
  stringList?: string[];
  intList?: number[];
  obj?: UserNestedObject | null;
}
