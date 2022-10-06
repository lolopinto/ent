export interface AccountPrefs {
  finishedNux: boolean;
  enableNotifs: boolean;
  preferredLanguage: string;
}

export function convertAccountPrefs(input: any): AccountPrefs {
  return {
    finishedNux: input.finished_nux,
    enableNotifs: input.enable_notifs,
    preferredLanguage: input.preferred_language,
  };
}

export function convertNullableAccountPrefs(input: any): AccountPrefs | null {
  if (input === undefined || input === null) {
    return null;
  }
  return convertAccountPrefs(input);
}
