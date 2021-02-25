import { graphql, commitMutation } from "react-relay";
import { Environment, PayloadError } from "relay-runtime";
import {
  EventActivityCreateInput,
  eventActivityCreateMutationResponse,
} from "../__generated__/eventActivityCreateMutation.graphql";

const mutation = graphql`
  mutation eventActivityCreateMutation($input: EventActivityCreateInput!) {
    eventActivityCreate(input: $input) {
      eventActivity {
        id
        name
        startTime
        endTime
        location
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

export default function commit(
  environment: Environment,
  input: EventActivityCreateInput,
  callback?: (
    r: eventActivityCreateMutationResponse,
    errs: ReadonlyArray<PayloadError> | null | undefined,
  ) => void,
) {
  return commitMutation(environment, {
    mutation,
    variables: { input },
    onCompleted: (response: eventActivityCreateMutationResponse, errors) => {
      if (callback) {
        Promise.resolve(callback(response, errors));
      }
    },
    onError: (err) => console.error(err),
  });
}
