import { graphql, commitMutation } from "react-relay";
import { Environment } from "relay-runtime";

const mutation = graphql`
  mutation emailAvailableMutation($email: String!) {
    emailAvailable(email: $email)
  }
`;

export default function commit(
  environment: Environment,
  email: string,
  callback?: any,
) {
  // Now we just call commitMutation with the appropriate parameters
  return commitMutation(environment, {
    mutation,
    variables: {
      email: email,
    },
    onCompleted: (response: any, errors) => {
      if (callback) {
        callback(response, errors);
      }
    },
    onError: (err) => console.error(err),
  });
}
