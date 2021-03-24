import { graphql } from "react-relay";
import {
  EventActivityAddInviteInput,
  eventActivityAddInviteMutationResponse,
} from "../__generated__/eventActivityAddInviteMutation.graphql";
import commit from "./base";

export default commit<
  EventActivityAddInviteInput,
  eventActivityAddInviteMutationResponse
>(
  graphql`
    mutation eventActivityAddInviteMutation(
      $input: EventActivityAddInviteInput!
    ) {
      eventActivityAddInvite(input: $input) {
        eventActivity {
          id
        }
      }
    }
  `,
);
