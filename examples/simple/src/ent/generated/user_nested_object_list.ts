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

export function convertUserNestedObjectList(input: any): UserNestedObjectList {
  return {
    type: input.type,
    enum: input.enum,
    objects: input.objects,
    enumList: input.enum_list,
  };
}

export function convertNullableUserNestedObjectList(
  input: any,
): UserNestedObjectList | null {
  if (input === undefined || input === null) {
    return null;
  }
  return convertUserNestedObjectList(input);
}

export function convertUserNestedObjectListList(
  input: any[],
): UserNestedObjectList[] {
  return input.map((v) => convertUserNestedObjectList(v));
}

export function convertNullableUserNestedObjectListList(
  input: any[] | null,
): UserNestedObjectList[] | null {
  if (input === null || input === undefined) {
    return null;
  }
  return input.map((v) => convertUserNestedObjectList(v));
}
