import { useState, useEffect } from "react";

export const LOGGED_IN_CREDS = "logged_in_creds";

interface Viewer {
  guest: {
    id: string;
  } | null;
  user: {
    id: string;
  } | null;
}

interface LoggedinCreds {
  token: string;
  viewer: Viewer;
}

export const SetLoggedInCreds = (token: string, viewer: Viewer) => {
  if (typeof localStorage === "undefined") {
    console.error(`tried to set token ${token} when localStorage is undefined`);
  } else {
    const creds = {
      token,
      viewer,
    };
    localStorage.setItem(LOGGED_IN_CREDS, JSON.stringify(creds));
  }
};

export function useSession(): [null | LoggedinCreds, boolean] {
  const [creds, setCreds] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (typeof localStorage === "undefined") {
      return;
    }
    const creds = localStorage.getItem(LOGGED_IN_CREDS);
    if (creds) {
      setCreds(creds);
    }
    setLoading(false);
  });

  return [creds, loading];
}
