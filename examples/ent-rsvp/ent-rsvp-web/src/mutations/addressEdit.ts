import { graphql } from "react-relay";
import {
  AddressEditInput,
  addressEditMutationResponse,
} from "../__generated__/addressEditMutation.graphql";
import commit from "./base";

const mutation = graphql`
  mutation addressEditMutation($input: AddressEditInput!) {
    addressEdit(input: $input) {
      address {
        id
      }
    }
  }
`;

export default commit<AddressEditInput, addressEditMutationResponse>(mutation);
