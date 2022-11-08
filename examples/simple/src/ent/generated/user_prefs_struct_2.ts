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

export function convertNullableUserPrefsStruct2(
  input: any,
): UserPrefsStruct2 | null {
  if (input === undefined || input === null) {
    return null;
  }
  return convertUserPrefsStruct2(input);
}

export function convertUserPrefsStruct2List(input: any[]): UserPrefsStruct2[] {
  return input.map((v) => convertUserPrefsStruct2(v));
}

export function convertNullableUserPrefsStruct2List(
  input: any[] | null,
): UserPrefsStruct2[] | null {
  if (input === null || input === undefined) {
    return null;
  }
  return input.map((v) => convertUserPrefsStruct2(v));
}
