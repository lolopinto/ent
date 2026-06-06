import { useCallback, useEffect, useState } from "react";

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

function getStoredCreds(): LoggedinCreds | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedCreds = window.localStorage.getItem(LOGGED_IN_CREDS);
  if (!storedCreds) {
    return null;
  }

  try {
    return JSON.parse(storedCreds) as LoggedinCreds;
  } catch {
    return null;
  }
}

export function useSession(): [
  null | LoggedinCreds,
  (t: string, v: Viewer) => void,
  () => void,
] {
  const [creds, setCreds] = useState<LoggedinCreds | null>(null);

  useEffect(() => {
    setCreds(getStoredCreds());
  }, []);

  const setCredsPublicAPI = useCallback((token: string, viewer: Viewer) => {
    const nextCreds = { token, viewer };
    setCreds(nextCreds);
    window.localStorage.setItem(LOGGED_IN_CREDS, JSON.stringify(nextCreds));
  }, []);

  const clearSession = useCallback(() => {
    setCreds(null);
    window.localStorage.removeItem(LOGGED_IN_CREDS);
  }, []);

  // TODO really need to verify that this is still valid in some way
  return [creds, setCredsPublicAPI, clearSession];
}
