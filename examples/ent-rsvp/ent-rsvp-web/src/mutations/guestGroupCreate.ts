import { graphql } from "react-relay";
import {
  GuestGroupCreateInput,
  guestGroupCreateMutationResponse,
} from "../__generated__/guestGroupCreateMutation.graphql";
import commit from "./base";

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

export default commit<GuestGroupCreateInput, guestGroupCreateMutationResponse>(
  mutation,
);
