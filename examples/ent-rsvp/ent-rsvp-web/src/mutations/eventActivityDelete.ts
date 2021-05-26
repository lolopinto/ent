import { graphql, commitMutation } from "react-relay";
import {
  Environment,
  PayloadError,
  RecordSourceSelectorProxy,
  ConnectionHandler,
} from "relay-runtime";
import {
  EventActivityDeleteInput,
  eventActivityDeleteMutationResponse,
} from "../__generated__/eventActivityDeleteMutation.graphql";

const mutation = graphql`
  mutation eventActivityDeleteMutation($input: EventActivityDeleteInput!) {
    eventActivityDelete(input: $input) {
      deletedEventActivityID
    }
  }
`;

export default function commit(
  environment: Environment,
  eventID: string,
  input: EventActivityDeleteInput,
  callback?: (
    r: eventActivityDeleteMutationResponse,
    errs: ReadonlyArray<PayloadError> | null | undefined,
  ) => void,
) {
  return commitMutation(environment, {
    mutation,
    updater: (store: RecordSourceSelectorProxy) => {
      // per https://relay.dev/docs/guided-tour/list-data/updating-connections/
      // and https://github.com/relayjs/relay-examples/blob/master/todo/js/mutations/RemoveTodoMutation.js#L64

      const payload = store.getRootField("eventActivityDelete");
      const deletedID = payload.getValue("deletedEventActivityID");
      if (typeof deletedID !== "string") {
        throw new Error(
          `Expected eventActivityDelete.deletedEventActivityID to be string, but got: ${typeof deletedID}`,
        );
      }

      const objProxy = store.get(eventID);
      const conn = ConnectionHandler.getConnection(
        objProxy,
        "Event_eventActivities",
      );
      if (!conn) {
        throw new Error(`couldn't load connection`);
      }
      ConnectionHandler.deleteNode(conn, deletedID);
    },

    variables: { input },
    onCompleted: (response: eventActivityDeleteMutationResponse, errors) => {
      if (callback) {
        Promise.resolve(callback(response, errors));
      }
    },
    onError: (err) => console.error(err),
  });
}
