import { graphql, commitMutation } from "react-relay";
import { Environment, PayloadError } from "relay-runtime";
import {
  GuestCreateInput,
  guestCreateMutationResponse,
} from "../__generated__/guestCreateMutation.graphql";

const mutation = graphql`
  mutation guestCreateMutation($input: GuestCreateInput!) {
    guestCreate(input: $input) {
      guest {
        id
      }
    }
  }
`;

// TODO simplify this for mutations so that all that's needed is the query and we can get the types easily
export default function commit(
  environment: Environment,
  input: GuestCreateInput,
  callback?: (
    r: guestCreateMutationResponse,
    errs: ReadonlyArray<PayloadError> | null | undefined,
  ) => void,
) {
  return commitMutation(environment, {
    mutation,
    variables: { input },
    onCompleted: (response: guestCreateMutationResponse, errors) => {
      if (callback) {
        Promise.resolve(callback(response, errors));
      }
    },
    onError: (err) => console.error(err),
  });
}
