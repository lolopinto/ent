import { graphql, commitMutation } from "react-relay";
import { Environment, PayloadError } from "relay-runtime";
import {
  AddressEditInput,
  addressEditMutationResponse,
} from "../__generated__/addressEditMutation.graphql";

const mutation = graphql`
  mutation addressEditMutation($input: AddressEditInput!) {
    addressEdit(input: $input) {
      address {
        id
      }
    }
  }
`;

export default function commit(
  environment: Environment,
  input: AddressEditInput,
  callback?: (
    r: addressEditMutationResponse,
    errs: ReadonlyArray<PayloadError> | null | undefined,
  ) => void,
) {
  return commitMutation(environment, {
    mutation,
    variables: { input },
    onCompleted: (response: addressEditMutationResponse, errors) => {
      if (callback) {
        Promise.resolve(callback(response, errors));
      }
    },
    onError: (err) => console.error(err),
  });
}
