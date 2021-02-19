import { graphql, commitMutation } from "react-relay";
import { Environment, PayloadError } from "relay-runtime";
import { SetLoggedInCreds } from "../session";
import {
  AuthUserInput,
  authUserMutationResponse,
} from "../__generated__/authUserMutation.graphql";

const mutation = graphql`
  mutation authUserMutation($input: AuthUserInput!) {
    authUser(input: $input) {
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
  input: AuthUserInput,
  callback?: (
    r: authUserMutationResponse,
    errs: ReadonlyArray<PayloadError> | null | undefined,
  ) => void,
) {
  return commitMutation(environment, {
    mutation,
    variables: {
      input,
    },
    onCompleted: (response: authUserMutationResponse, errors) => {
      console.log(response);
      const r = response.authUser;
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
