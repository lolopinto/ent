import { graphql } from "react-relay";
import {
  GuestCreateInput,
  guestCreateMutationResponse,
} from "../__generated__/guestCreateMutation.graphql";
import commit from "./base";

const mutation = graphql`
  mutation guestCreateMutation($input: GuestCreateInput!) {
    guestCreate(input: $input) {
      guest {
        id
      }
    }
  }
`;

export default commit<GuestCreateInput, guestCreateMutationResponse>(mutation);
