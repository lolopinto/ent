/**
 * Copyright whaa whaa
 */

export enum NotifTypes {
  MOBILE = "MOBILE",
  WEB = "WEB",
  EMAIL = "EMAIL",
}

interface UserPrefsStruct {
  finishedNux?: boolean | null;
  enableNotifs?: boolean | null;
  notifTypes?: NotifTypes;
}
