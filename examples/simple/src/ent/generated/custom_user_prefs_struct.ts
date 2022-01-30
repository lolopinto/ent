/**
 * Copyright whaa whaa
 */

export enum NotifTypes {
  MOBILE = "MOBILE",
  WEB = "WEB",
  EMAIL = "EMAIL",
}

interface CustomUserPrefsStruct {
  finishedNux?: boolean | null;
  enableNotifs?: boolean | null;
  notifTypes?: NotifTypes;
}
