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

export function convertUserNestedNestedObjectList(
  input: any,
): UserNestedNestedObjectList {
  return {
    int: input.int,
  };
}

export interface UserNestedObjectList {
  type: string;
  enum: EnumUsedInList;
  objects: UserNestedNestedObjectList[];
  enumList: IntEnumUsedInList[];
}

export function convertUserNestedObjectList(input: any): UserNestedObjectList {
  return {
    type: input.type,
    enum: input.enum,
    objects: convertUserNestedNestedObjectList(input.objects),
    enumList: input.enum_list,
  };
}
