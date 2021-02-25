import { graphql, commitMutation } from "react-relay";
import { Environment, PayloadError } from "relay-runtime";
import {
  EventCreateInput,
  eventCreateMutationResponse,
} from "../__generated__/eventCreateMutation.graphql";

const mutation = graphql`
  mutation eventCreateMutation($input: EventCreateInput!) {
    eventCreate(input: $input) {
      event {
        id
        slug
        ...eventFragment
      }
    }
  }
`;

export default function commit(
  environment: Environment,
  input: EventCreateInput,
  callback?: (
    r: eventCreateMutationResponse,
    errs: ReadonlyArray<PayloadError> | null | undefined,
  ) => void,
) {
  return commitMutation(environment, {
    mutation,
    variables: { input },
    onCompleted: (response: eventCreateMutationResponse, errors) => {
      if (callback) {
        Promise.resolve(callback(response, errors));
      }
    },
    onError: (err) => console.error(err),
  });
}
