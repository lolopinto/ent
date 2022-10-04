/**
 * Copyright whaa whaa
 */

export enum NotifType2 {
  MOBILE = "MOBILE",
  WEB = "WEB",
  EMAIL = "EMAIL",
}

export interface UserPrefsStruct2 {
  finishedNux?: boolean | null;
  enableNotifs?: boolean | null;
  notifTypes: NotifType2[];
}

export function convertUserPrefsStruct2(input: any): UserPrefsStruct2 {
  return {
    finishedNux: input.finished_nux,
    enableNotifs: input.enable_notifs,
    notifTypes: input.notif_types,
  };
}
