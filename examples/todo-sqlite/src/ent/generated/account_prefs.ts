export interface AccountPrefs {
  finishedNux: boolean;
  enableNotifs: boolean;
  preferredLanguage: string;
}

// TODO convert objects
function convertAccountPrefs(input: any): AccountPrefs {
  return {
    finishedNux: input.finished_nux,
    enableNotifs: input.enable_notifs,
    preferredLanguage: input.preferred_language,
  };
}

// TODO convertFooMethod and if exported...

//then need something for graphql input just in case for the account.test.ts case
// there's convert from db
// and convert from grapphql

// there's also logic about convert to db in format()??
// for now we can just getStorageKey() since that's all JS code...
