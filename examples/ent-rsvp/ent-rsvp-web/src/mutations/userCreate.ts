import { graphql, commitMutation } from "react-relay";
import { Environment, PayloadError } from "relay-runtime";
import {
  UserCreateInput,
  userCreateMutationResponse,
} from "../__generated__/userCreateMutation.graphql";
import commit from "./base";

const mutation = graphql`
  mutation userCreateMutation($input: UserCreateInput!) {
    userCreate(input: $input) {
      user {
        id
      }
    }
  }
`;

export default commit<UserCreateInput, userCreateMutationResponse>(mutation);
