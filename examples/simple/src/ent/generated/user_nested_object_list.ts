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

export function convertNullableUserNestedNestedObjectList(
  input: any,
): UserNestedNestedObjectList | null {
  if (input === undefined || input === null) {
    return null;
  }
  return convertUserNestedNestedObjectList(input);
}

export function convertUserNestedNestedObjectListList(
  input: any[],
): UserNestedNestedObjectList[] {
  return input.map((v) => convertUserNestedNestedObjectList(v));
}

export function convertNullableUserNestedNestedObjectListList(
  input: any[] | null,
): UserNestedNestedObjectList[] | null {
  if (input === null || input === undefined) {
    return null;
  }
  return input.map((v) => convertUserNestedNestedObjectList(v));
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
    objects: convertUserNestedNestedObjectListList(input.objects),
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
