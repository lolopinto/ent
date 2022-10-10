/**
 * Copyright whaa whaa
 */

export interface UserPrefsDiff {
  type: string;
}

export function convertUserPrefsDiff(input: any): UserPrefsDiff {
  return {
    type: input.type,
  };
}

export function convertNullableUserPrefsDiff(input: any): UserPrefsDiff | null {
  if (input === undefined || input === null) {
    return null;
  }
  return convertUserPrefsDiff(input);
}
