import { graphql, commitMutation } from "react-relay";
import { Environment, PayloadError } from "relay-runtime";
import { SetLoggedInCreds } from "../session";
import {
  AuthGuestInput,
  authGuestMutationResponse,
} from "../__generated__/authGuestMutation.graphql";

const mutation = graphql`
  mutation authGuestMutation($input: AuthGuestInput!) {
    authGuest(input: $input) {
      viewer {
        guest {
          id
        }
        user {
          id
        }
      }
      token
    }
  }
`;

export default function commit(
  environment: Environment,
  input: AuthGuestInput,
  callback?: (
    r: authGuestMutationResponse,
    errs: ReadonlyArray<PayloadError> | null | undefined,
  ) => void,
) {
  return commitMutation(environment, {
    mutation,
    variables: {
      input,
    },
    onCompleted: (response: authGuestMutationResponse, errors) => {
      console.log(response);
      const r = response.authGuest;
      if (r.token) {
        SetLoggedInCreds(r.token, r.viewer);
      }
      if (callback) {
        callback(response, errors);
      }
    },
    onError: (err) => console.error(err),
  });
}
