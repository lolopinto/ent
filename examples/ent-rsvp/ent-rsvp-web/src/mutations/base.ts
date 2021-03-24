import { commitMutation } from "react-relay";
import { Environment, PayloadError, GraphQLTaggedNode } from "relay-runtime";

export default function commit<TInput, TResponse>(mutation: GraphQLTaggedNode) {
  return function (
    environment: Environment,

    input: TInput,
    callback?: (
      r: TResponse,
      errs: ReadonlyArray<PayloadError> | null | undefined,
    ) => void,
  ) {
    return commitMutation(environment, {
      mutation,
      variables: { input },
      onCompleted: (response: TResponse, errors) => {
        if (callback) {
          Promise.resolve(callback(response, errors));
        }
      },
      onError: (err) => console.error(err),
    });
  };
}
