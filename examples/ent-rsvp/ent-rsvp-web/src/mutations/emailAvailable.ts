import { graphql } from "react-relay";
import {
  emailAvailableMutationVariables,
  emailAvailableMutationResponse,
} from "../__generated__/emailAvailableMutation.graphql";
import commit from "./base";

const mutation = graphql`
  mutation emailAvailableMutation($email: String!) {
    emailAvailable(email: $email)
  }
`;

export default commit<
  emailAvailableMutationVariables,
  emailAvailableMutationResponse
>(mutation);
