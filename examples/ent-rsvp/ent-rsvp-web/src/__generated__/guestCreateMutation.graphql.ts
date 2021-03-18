/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type GuestCreateInput = {
    firstName: string;
    lastName: string;
    emailAddress: string;
    eventID: string;
    guestGroupID: string;
};
export type guestCreateMutationVariables = {
    input: GuestCreateInput;
};
export type guestCreateMutationResponse = {
    readonly guestCreate: {
        readonly guest: {
            readonly id: string;
        };
    };
};
export type guestCreateMutation = {
    readonly response: guestCreateMutationResponse;
    readonly variables: guestCreateMutationVariables;
};



/*
mutation guestCreateMutation(
  $input: GuestCreateInput!
) {
  guestCreate(input: $input) {
    guest {
      id
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
    "concreteType": "GuestCreatePayload",
    "kind": "LinkedField",
    "name": "guestCreate",
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
    "name": "guestCreateMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "guestCreateMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "7ec4849a182d14d05e7eb8cf4fca7441",
    "id": null,
    "metadata": {},
    "name": "guestCreateMutation",
    "operationKind": "mutation",
    "text": "mutation guestCreateMutation(\n  $input: GuestCreateInput!\n) {\n  guestCreate(input: $input) {\n    guest {\n      id\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = '8eb6e3365fc239faa28c249b393537da';
export default node;
