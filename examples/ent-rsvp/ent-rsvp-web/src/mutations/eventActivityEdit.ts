import { graphql, commitMutation } from "react-relay";
import { Environment, PayloadError } from "relay-runtime";
import {
  EventActivityEditInput,
  eventActivityEditMutationResponse,
} from "../__generated__/eventActivityEditMutation.graphql";

const mutation = graphql`
  mutation eventActivityEditMutation($input: EventActivityEditInput!) {
    eventActivityEdit(input: $input) {
      eventActivity {
        id
      }
    }
  }
`;

export default function commit(
  environment: Environment,
  input: EventActivityEditInput,
  callback?: (
    r: eventActivityEditMutationResponse,
    errs: ReadonlyArray<PayloadError> | null | undefined,
  ) => void,
) {
  return commitMutation(environment, {
    mutation,
    variables: { input },
    onCompleted: (response: eventActivityEditMutationResponse, errors) => {
      if (callback) {
        Promise.resolve(callback(response, errors));
      }
    },
    onError: (err) => console.error(err),
  });
}
