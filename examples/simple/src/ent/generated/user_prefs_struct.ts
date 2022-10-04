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

// TODO convertFooMethod and if exported...

//then need something for graphql input just in case for the account.test.ts case
// there's convert from db
// and convert from grapphql

// there's also logic about convert to db in format()??
// for now we can just getStorageKey() since that's all JS code...
