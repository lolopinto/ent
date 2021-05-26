import { graphql } from "react-relay";
import {
  EventActivityCreateInput,
  eventActivityCreateMutationResponse,
} from "../__generated__/eventActivityCreateMutation.graphql";
import commit from "./base";

const mutation = graphql`
  mutation eventActivityCreateMutation($input: EventActivityCreateInput!) {
    eventActivityCreate(input: $input) {
      eventActivity {
        id
        name
        startTime
        endTime
        location
        inviteAllGuests
        address {
          id
          street
          city
          state
          zipCode
          apartment
        }
      }
    }
  }
`;

export default commit<
  EventActivityCreateInput,
  eventActivityCreateMutationResponse
>(mutation);
