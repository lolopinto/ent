import { graphql } from "react-relay";
import {
  AuthUserInput,
  authUserMutationResponse,
} from "../__generated__/authUserMutation.graphql";
import commit from "./base";

const mutation = graphql`
  mutation authUserMutation($input: AuthUserInput!) {
    authUser(input: $input) {
      viewer {
        user {
          id
        }
        guest {
          id
          emailAddress
        }
      }
      token
    }
  }
`;

export default commit<AuthUserInput, authUserMutationResponse>(mutation);
