import { graphql, commitMutation } from "react-relay";
import { Environment, PayloadError } from "relay-runtime";
import {
  UserCreateInput,
  userCreateMutationResponse,
} from "../__generated__/userCreateMutation.graphql";

const mutation = graphql`
  mutation userCreateMutation($input: UserCreateInput!) {
    userCreate(input: $input) {
      user {
        id
      }
    }
  }
`;

export default function commit(
  environment: Environment,
  input: UserCreateInput,
  callback?: (
    r: userCreateMutationResponse,
    errs: ReadonlyArray<PayloadError> | undefined | null,
  ) => void,
) {
  return commitMutation(environment, {
    mutation,
    variables: {
      input,
    },
    onCompleted: (response: userCreateMutationResponse, errors) => {
      console.log("Response received from server.", response, errors);
      if (callback) {
        callback(response, errors);
      }
    },
    onError: (err) => {
      console.log("wwhwww");
      console.error(err);
    },
  });
}
