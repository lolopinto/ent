import { graphql, commitMutation } from "react-relay";
import { Environment, PayloadError } from "relay-runtime";
import {
  GuestGroupCreateInput,
  guestGroupCreateMutationResponse,
} from "../__generated__/guestGroupCreateMutation.graphql";

const mutation = graphql`
  mutation guestGroupCreateMutation($input: GuestGroupCreateInput!) {
    guestGroupCreate(input: $input) {
      guestGroup {
        id
        invitationName
      }
    }
  }
`;

export default function commit(
  environment: Environment,
  input: GuestGroupCreateInput,
  callback?: (
    r: guestGroupCreateMutationResponse,
    errs: ReadonlyArray<PayloadError> | null | undefined,
  ) => void,
) {
  return commitMutation(environment, {
    mutation,
    variables: { input },
    onCompleted: (response: guestGroupCreateMutationResponse, errors) => {
      if (callback) {
        Promise.resolve(callback(response, errors));
      }
    },
    onError: (err) => console.error(err),
  });
}
