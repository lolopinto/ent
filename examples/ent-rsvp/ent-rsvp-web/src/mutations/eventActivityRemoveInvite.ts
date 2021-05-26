import { graphql } from "react-relay";
import {
  EventActivityRemoveInviteInput,
  eventActivityRemoveInviteMutationResponse,
} from "../__generated__/eventActivityRemoveInviteMutation.graphql";
import commit from "./base";

export default commit<
  EventActivityRemoveInviteInput,
  eventActivityRemoveInviteMutationResponse
>(
  graphql`
    mutation eventActivityRemoveInviteMutation(
      $input: EventActivityRemoveInviteInput!
    ) {
      eventActivityRemoveInvite(input: $input) {
        eventActivity {
          id
        }
      }
    }
  `,
);
