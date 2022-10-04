/**
 * Copyright whaa whaa
 */

export enum ContactInfoSource {
  Friend = "friend",
  Work = "work",
  Online = "online",
}

export interface ContactInfo {
  default: boolean;
  source: ContactInfoSource;
}

export function convertContactInfo(input: any): ContactInfo {
  return {
    default: input.default,
    source: input.source,
  };
}

// TODO convertFooMethod and if exported...

//then need something for graphql input just in case for the account.test.ts case
// there's convert from db
// and convert from grapphql

// there's also logic about convert to db in format()??
// for now we can just getStorageKey() since that's all JS code...
