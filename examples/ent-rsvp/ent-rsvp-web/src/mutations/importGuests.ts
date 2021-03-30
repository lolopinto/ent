import { graphql } from "react-relay";
import { importGuestsMutationResponse } from "../__generated__/importGuestsMutation.graphql";
import commit from "./base";
const mutation = graphql`
  mutation importGuestsMutation($eventID: ID!, $file: Upload!) {
    importGuests(eventID: $eventID, file: $file) {
      id
    }
  }
`;

export default commit<
  { eventID: string; file: File },
  importGuestsMutationResponse
>(mutation, true);
