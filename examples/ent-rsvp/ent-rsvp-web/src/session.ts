import { useLocalStorage } from "react-use";
export const LOGGED_IN_CREDS = "logged_in_creds";

interface Viewer {
  guest: {
    id: string;
    // not really null but nullable because gql
    emailAddress: string | null;
  } | null;
  user: {
    id: string;
  } | null;
}

interface LoggedinCreds {
  token: string;
  viewer: Viewer;
}

export function useSession(): [
  null | LoggedinCreds,
  (t: string, v: Viewer) => void,
  () => void,
] {
  const [creds, setCreds, clearSession] = useLocalStorage(LOGGED_IN_CREDS);

  const setCredsPublicAPI = (token: string, viewer: Viewer) => {
    console.log(token, viewer);
    setCreds({ token, viewer });
  };

  // TODO really need to verify that this is still valid in some way
  return [creds as LoggedinCreds, setCredsPublicAPI, clearSession];
}
