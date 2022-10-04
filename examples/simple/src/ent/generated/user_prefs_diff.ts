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

// TODO convertFooMethod and if exported...

//then need something for graphql input just in case for the account.test.ts case
// there's convert from db
// and convert from grapphql

// there's also logic about convert to db in format()??
// for now we can just getStorageKey() since that's all JS code...
