import { graphql } from "react-relay";
import {
  EventCreateInput,
  eventCreateMutationResponse,
} from "../__generated__/eventCreateMutation.graphql";
import commit from "./base";

const mutation = graphql`
  mutation eventCreateMutation($input: EventCreateInput!) {
    eventCreate(input: $input) {
      event {
        id
        slug
        ...eventFragment
      }
    }
  }
`;

export default commit<EventCreateInput, eventCreateMutationResponse>(mutation);
