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

// TODO convertFooMethod and if exported...

//then need something for graphql input just in case for the account.test.ts case
// there's convert from db
// and convert from grapphql

// there's also logic about convert to db in format()??
// for now we can just getStorageKey() since that's all JS code...
