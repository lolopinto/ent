/**
 * Copyright whaa whaa
 */

export enum EnumUsedInList {
  Yes = "yes",
  No = "no",
  Maybe = "maybe",
}

export interface UserNestedNestedObjectList {
  int: number;
}

export interface UserNestedObjectList {
  type: string;
  enum: EnumUsedInList;
  objects: UserNestedNestedObjectList[];
}
