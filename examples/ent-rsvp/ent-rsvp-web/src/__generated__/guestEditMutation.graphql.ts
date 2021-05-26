/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type GuestEditInput = {
    guestID: string;
    name?: string | null;
    emailAddress?: string | null;
};
export type guestEditMutationVariables = {
    input: GuestEditInput;
};
export type guestEditMutationResponse = {
    readonly guestEdit: {
        readonly guest: {
            readonly id: string;
            readonly name: string;
        };
    };
};
export type guestEditMutation = {
    readonly response: guestEditMutationResponse;
    readonly variables: guestEditMutationVariables;
};



/*
mutation guestEditMutation(
  $input: GuestEditInput!
) {
  guestEdit(input: $input) {
    guest {
      id
      name
    }
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
    "concreteType": "GuestEditPayload",
    "kind": "LinkedField",
    "name": "guestEdit",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Guest",
        "kind": "LinkedField",
        "name": "guest",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "name",
            "storageKey": null
          }
        ],
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
    "name": "guestEditMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "guestEditMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "87d5af53f02f0fca6943a60fd2044acc",
    "id": null,
    "metadata": {},
    "name": "guestEditMutation",
    "operationKind": "mutation",
    "text": "mutation guestEditMutation(\n  $input: GuestEditInput!\n) {\n  guestEdit(input: $input) {\n    guest {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = '4da5a3ee4f76b11d9750135313012898';
export default node;
