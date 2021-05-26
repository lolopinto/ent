import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { extractFiles } from "extract-files";

async function fetchQuery(operation, variables) {
  try {
    let headers = {
      Accept: "application/json",
    };
    if (typeof localStorage !== "undefined") {
      const creds = localStorage.getItem("logged_in_creds");
      if (creds) {
        const credsObj = JSON.parse(creds);
        headers["Authorization"] = `Bearer ${credsObj.token}`;
      }
    }

    const fetchOptions: RequestInit = {
      method: "POST",
      headers,
    };

    const op = {
      query: operation.text,
      variables,
    };

    const { clone, files } = extractFiles(
      op,
      undefined,
      typeof File !== "undefined"
        ? function (f): f is File {
            return f instanceof File;
          }
        : undefined,
    );
    const opJSON = JSON.stringify(clone);

    if (files.size) {
      const form = new FormData();

      form.append("operations", opJSON);

      const map = {};
      let i = 0;
      files.forEach((paths) => {
        map[i++] = paths;
      });
      form.append("map", JSON.stringify(map));

      i = 0;
      files.forEach((paths, file) => {
        form.append(`${i++}`, file, file.name);
      });
      fetchOptions.body = form;
    } else {
      fetchOptions.headers["Content-Type"] = "application/json";
      fetchOptions.body = opJSON;
    }

    const response = await fetch(
      process.env.NEXT_PUBLIC_RELAY_ENDPOINT,
      fetchOptions,
    );
    return await response.json();
  } catch (err) {
    console.log("errrrrorrrrr");
    console.error(err);
  }
}

let relayEnvironment: Environment = null;
export default function initEnvironment({ records = {} } = {}) {
  // Create a network layer from the fetch function
  const network = Network.create(fetchQuery);
  const store = new Store(new RecordSource(records));

  // Make sure to create a new Relay environment for every server-side request so that data
  // isn't shared between connections (which would be bad)
  // maybe simplify this if we disable server-side rendering
  if (!process.browser) {
    return new Environment({
      network,
      store,
    });
  }

  // reuse Relay environment on client-side
  if (!relayEnvironment) {
    relayEnvironment = new Environment({
      network,
      store,
    });
  }

  return relayEnvironment;
}
