/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type GuestGroupDeleteInput = {
    guestGroupID: string;
};
export type guestGroupDeleteMutationVariables = {
    input: GuestGroupDeleteInput;
};
export type guestGroupDeleteMutationResponse = {
    readonly guestGroupDelete: {
        readonly deletedGuestGroupID: string | null;
    };
};
export type guestGroupDeleteMutation = {
    readonly response: guestGroupDeleteMutationResponse;
    readonly variables: guestGroupDeleteMutationVariables;
};



/*
mutation guestGroupDeleteMutation(
  $input: GuestGroupDeleteInput!
) {
  guestGroupDelete(input: $input) {
    deletedGuestGroupID
  }
}
*/

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "GuestGroupDeletePayload",
    "kind": "LinkedField",
    "name": "guestGroupDelete",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "deletedGuestGroupID",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "guestGroupDeleteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "guestGroupDeleteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "56c15378aa1c8fc0531e0ed19e24c8da",
    "id": null,
    "metadata": {},
    "name": "guestGroupDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation guestGroupDeleteMutation(\n  $input: GuestGroupDeleteInput!\n) {\n  guestGroupDelete(input: $input) {\n    deletedGuestGroupID\n  }\n}\n"
  }
};
})();
(node as any).hash = '275de8104c4ee88a257d30a6b1818183';
export default node;
