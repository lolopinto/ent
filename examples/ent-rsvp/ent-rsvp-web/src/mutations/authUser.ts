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
        guest {
          id
          emailAddress
        }
        user {
          id
        }
      }
      token
    }
  }
`;

export default commit<AuthUserInput, authUserMutationResponse>(mutation);
