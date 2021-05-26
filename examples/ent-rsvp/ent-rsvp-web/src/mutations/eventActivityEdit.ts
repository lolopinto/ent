import { graphql } from "react-relay";
import {
  EventActivityEditInput,
  eventActivityEditMutationResponse,
} from "../__generated__/eventActivityEditMutation.graphql";
import commit from "./base";

const mutation = graphql`
  mutation eventActivityEditMutation($input: EventActivityEditInput!) {
    eventActivityEdit(input: $input) {
      eventActivity {
        id
      }
    }
  }
`;

export default commit<
  EventActivityEditInput,
  eventActivityEditMutationResponse
>(mutation);
