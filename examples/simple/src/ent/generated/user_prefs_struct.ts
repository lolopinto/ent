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

export function convertUserPrefsStruct(input: any): UserPrefsStruct {
  return {
    finishedNux: input.finished_nux,
    enableNotifs: input.enable_notifs,
    notifTypes: input.notif_types,
  };
}
