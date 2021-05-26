import { graphql } from "react-relay";
import {
  EventActivityRsvpStatusEditInput,
  eventActivityRsvpStatusEditMutationResponse,
} from "../__generated__/eventActivityRsvpStatusEditMutation.graphql";
import commit from "./base";

const mutation = graphql`
  mutation eventActivityRsvpStatusEditMutation(
    $input: EventActivityRsvpStatusEditInput!
  ) {
    eventActivityRsvpStatusEdit(input: $input) {
      eventActivity {
        id
      }
    }
  }
`;

export default commit<
  EventActivityRsvpStatusEditInput,
  eventActivityRsvpStatusEditMutationResponse
>(mutation);
