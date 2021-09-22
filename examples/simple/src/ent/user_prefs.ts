export enum NotifType {
  MOBILE = 1,
  WEB = 2,
  EMAIL = 3,
}

export interface UserPrefs {
  finishedNux?: boolean;
  enableNotifs?: boolean;
  notifTypes: NotifType[];
}
