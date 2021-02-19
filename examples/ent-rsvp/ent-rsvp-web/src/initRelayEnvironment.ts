import { Environment, Network, RecordSource, Store } from "relay-runtime";

async function fetchQuery(operation, variables) {
  return await fetch(process.env.NEXT_PUBLIC_RELAY_ENDPOINT, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      // TODO
      //      "Authorization": `Bearer ${AuthToken()}`,
    },
    body: JSON.stringify({
      query: operation.text, // GraphQL text from input
      variables,
    }),
  }).then((response) => response.json());
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
