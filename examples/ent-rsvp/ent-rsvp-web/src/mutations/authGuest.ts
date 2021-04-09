import { graphql } from "react-relay";
import commit from "./base";

import {
  AuthGuestInput,
  authGuestMutationResponse,
} from "../__generated__/authGuestMutation.graphql";

const mutation = graphql`
  mutation authGuestMutation($input: AuthGuestInput!) {
    authGuest(input: $input) {
      viewer {
        guest {
          id
          emailAddress
        }
      }
      token
    }
  }
`;

export default commit<AuthGuestInput, authGuestMutationResponse>(mutation);
