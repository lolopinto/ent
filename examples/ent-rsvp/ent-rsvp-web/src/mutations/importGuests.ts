import { graphql, commitMutation } from "react-relay";
import { Environment, PayloadError } from "relay-runtime";
import { importGuestsMutationResponse } from "../__generated__/importGuestsMutation.graphql";

const mutation = graphql`
  mutation importGuestsMutation($eventID: ID!, $file: Upload!) {
    importGuests(eventID: $eventID, file: $file) {
      id
    }
  }
`;

export default function commit(
  environment: Environment,
  eventID: string,
  file: File,
  callback?: (
    r: importGuestsMutationResponse,
    errs: ReadonlyArray<PayloadError> | null | undefined,
  ) => void,
) {
  return commitMutation(environment, {
    mutation,
    variables: { eventID, file },
    onCompleted: (response: importGuestsMutationResponse, errors) => {
      if (callback) {
        Promise.resolve(callback(response, errors));
      }
    },
    onError: (err) => console.error(err),
  });
}
