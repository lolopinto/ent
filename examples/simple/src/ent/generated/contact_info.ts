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

export function convertNullableContactInfo(input: any): ContactInfo | null {
  if (input === undefined || input === null) {
    return null;
  }
  return convertContactInfo(input);
}
