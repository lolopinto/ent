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
