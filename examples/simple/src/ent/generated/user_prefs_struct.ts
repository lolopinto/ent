/**
 * Copyright whaa whaa
 */

export enum NotifType {
  MOBILE = "MOBILE",
  WEB = "WEB",
  EMAIL = "EMAIL",
}

export interface UserPrefsStruct {
  finishedNux?: boolean | null;
  enableNotifs?: boolean | null;
  notifTypes: NotifType[];
}
