import { graphql, commitMutation } from "react-relay";
import { Environment, PayloadError } from "relay-runtime";
import {
  emailAvailableMutationVariables,
  emailAvailableMutationResponse,
} from "../__generated__/emailAvailableMutation.graphql";

const mutation = graphql`
  mutation emailAvailableMutation($email: String!) {
    emailAvailable(email: $email)
  }
`;

export default function commit(
  environment: Environment,
  vars: emailAvailableMutationVariables,
  callback?: (
    r: emailAvailableMutationResponse,
    errs: ReadonlyArray<PayloadError> | null | undefined,
  ) => void,
) {
  return commitMutation(environment, {
    mutation,
    variables: vars,
    onCompleted: (
      response: emailAvailableMutationResponse,
      errors: ReadonlyArray<PayloadError> | null | undefined,
    ) => {
      if (callback) {
        callback(response, errors);
      }
    },
    onError: (err) => console.error(err),
  });
}
