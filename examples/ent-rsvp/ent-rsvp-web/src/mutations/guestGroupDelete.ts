import { graphql, commitMutation } from "react-relay";
import {
  Environment,
  PayloadError,
  RecordSourceSelectorProxy,
  ConnectionHandler,
} from "relay-runtime";
import {
  GuestGroupDeleteInput,
  guestGroupDeleteMutationResponse,
} from "../__generated__/guestGroupDeleteMutation.graphql";

const mutation = graphql`
  mutation guestGroupDeleteMutation($input: GuestGroupDeleteInput!) {
    guestGroupDelete(input: $input) {
      deletedGuestGroupID
    }
  }
`;

export default function commit(
  environment: Environment,
  eventID: string,
  input: GuestGroupDeleteInput,
  callback?: (
    r: guestGroupDeleteMutationResponse,
    errs: ReadonlyArray<PayloadError> | null | undefined,
  ) => void,
) {
  return commitMutation(environment, {
    mutation,
    updater: (store: RecordSourceSelectorProxy) => {
      // per https://relay.dev/docs/guided-tour/list-data/updating-connections/
      // and https://github.com/relayjs/relay-examples/blob/master/todo/js/mutations/RemoveTodoMutation.js#L64

      const payload = store.getRootField("guestGroupDelete");
      const deletedID = payload.getValue("deletedGuestGroupID");
      if (typeof deletedID !== "string") {
        throw new Error(
          `Expected guestGroupDelete.deletedGuestGroupID to be string, but got: ${typeof deletedID}`,
        );
      }

      const objProxy = store.get(eventID);
      const conn = ConnectionHandler.getConnection(
        objProxy,
        "Event_guestGroups",
      );
      if (!conn) {
        throw new Error(`couldn't load connection`);
      }
      ConnectionHandler.deleteNode(conn, deletedID);
    },

    variables: { input },
    onCompleted: (response: guestGroupDeleteMutationResponse, errors) => {
      if (callback) {
        Promise.resolve(callback(response, errors));
      }
    },
    onError: (err) => console.error(err),
  });
}
