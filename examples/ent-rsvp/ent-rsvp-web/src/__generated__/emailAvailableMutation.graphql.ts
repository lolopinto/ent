/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type emailAvailableMutationVariables = {
    email: string;
};
export type emailAvailableMutationResponse = {
    readonly emailAvailable: boolean;
};
export type emailAvailableMutation = {
    readonly response: emailAvailableMutationResponse;
    readonly variables: emailAvailableMutationVariables;
};



/*
mutation emailAvailableMutation(
  $email: String!
) {
  emailAvailable(email: $email)
}
*/

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "email"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "email",
        "variableName": "email"
      }
    ],
    "kind": "ScalarField",
    "name": "emailAvailable",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "emailAvailableMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "emailAvailableMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "bf6f78f0822bfddff05e367a9fa09532",
    "id": null,
    "metadata": {},
    "name": "emailAvailableMutation",
    "operationKind": "mutation",
    "text": "mutation emailAvailableMutation(\n  $email: String!\n) {\n  emailAvailable(email: $email)\n}\n"
  }
};
})();
(node as any).hash = '76933fa0890a5ee47192468295570511';
export default node;
