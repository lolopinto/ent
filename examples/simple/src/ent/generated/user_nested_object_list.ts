/**
 * Copyright whaa whaa
 */

export enum EnumUsedInList {
  Yes = "yes",
  No = "no",
  Maybe = "maybe",
}

export enum IntEnumUsedInList {
  Yes = 1,
  No = 2,
  Maybe = 3,
}

export interface UserNestedNestedObjectList {
  int: number;
}

export interface UserNestedObjectList {
  type: string;
  enum: EnumUsedInList;
  objects: UserNestedNestedObjectList[];
  enumList: IntEnumUsedInList[];
}
