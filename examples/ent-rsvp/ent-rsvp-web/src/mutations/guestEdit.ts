import { graphql } from "react-relay";
import {
  GuestEditInput,
  guestEditMutationResponse,
} from "../__generated__/guestEditMutation.graphql";
import commit from "./base";

const mutation = graphql`
  mutation guestEditMutation($input: GuestEditInput!) {
    guestEdit(input: $input) {
      guest {
        id
        name
      }
    }
  }
`;

export default commit<GuestEditInput, guestEditMutationResponse>(mutation);
