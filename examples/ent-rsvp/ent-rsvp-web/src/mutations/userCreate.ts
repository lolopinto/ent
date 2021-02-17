import { graphql, commitMutation } from "react-relay";
import { Environment } from "relay-runtime";

const mutation = graphql`
  mutation userCreateMutation($input: UserCreateInput!) {
    userCreate(input: $input) {
      user {
        id
      }
    }
  }
`;

export default function commit(
  environment: Environment,
  firstName: string,
  lastName: string,
  emailAddress: string,
  password: string,
  callback?: any,
) {
  // Now we just call commitMutation with the appropriate parameters
  return commitMutation(environment, {
    mutation,
    variables: {
      input: { firstName, lastName, emailAddress, password },
    },
    onCompleted: (response: any, errors) => {
      console.log("Response received from server.", response, errors);
      if (callback) {
        callback(response, errors);
      }
    },
    onError: (err) => console.error(err),
  });
}
