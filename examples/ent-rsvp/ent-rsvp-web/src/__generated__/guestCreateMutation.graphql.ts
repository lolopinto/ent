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
            readonly firstName: string;
            readonly lastName: string;
            readonly emailAddress: string;
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
      firstName
      lastName
      emailAddress
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
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "firstName",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "lastName",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "emailAddress",
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
    "cacheID": "a4909b7c0fe06a3bf5dcf3ecc15b59ed",
    "id": null,
    "metadata": {},
    "name": "guestCreateMutation",
    "operationKind": "mutation",
    "text": "mutation guestCreateMutation(\n  $input: GuestCreateInput!\n) {\n  guestCreate(input: $input) {\n    guest {\n      id\n      firstName\n      lastName\n      emailAddress\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = '077707e4a01510e6304ee7f1dfd24245';
export default node;
