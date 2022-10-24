export interface AccountPrefs2 {
  finishedNux: boolean;
  enableNotifs: boolean;
  preferredLanguage: string;
}

export function convertAccountPrefs2(input: any): AccountPrefs2 {
  return {
    finishedNux: input.finished_nux,
    enableNotifs: input.enable_notifs,
    preferredLanguage: input.preferred_language,
  };
}

export function convertNullableAccountPrefs2(input: any): AccountPrefs2 | null {
  if (input === undefined || input === null) {
    return null;
  }
  return convertAccountPrefs2(input);
}

export function convertAccountPrefs2List(input: any[]): AccountPrefs2[] {
  return input.map((v) => convertAccountPrefs2(v));
}

export function convertNullableAccountPrefs2List(
  input: any[] | null,
): AccountPrefs2[] | null {
  if (input === null || input === undefined) {
    return null;
  }
  return input.map((v) => convertAccountPrefs2(v));
}
