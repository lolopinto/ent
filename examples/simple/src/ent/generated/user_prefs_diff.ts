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
