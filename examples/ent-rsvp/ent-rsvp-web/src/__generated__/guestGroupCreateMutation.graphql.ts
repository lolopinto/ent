/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type GuestGroupCreateInput = {
    invitationName: string;
    eventID: string;
    guests?: Array<GuestGuestGroupCreateInput> | null;
};
export type GuestGuestGroupCreateInput = {
    name: string;
    emailAddress?: string | null;
    title?: string | null;
};
export type guestGroupCreateMutationVariables = {
    input: GuestGroupCreateInput;
};
export type guestGroupCreateMutationResponse = {
    readonly guestGroupCreate: {
        readonly guestGroup: {
            readonly id: string;
            readonly invitationName: string;
        };
    };
};
export type guestGroupCreateMutation = {
    readonly response: guestGroupCreateMutationResponse;
    readonly variables: guestGroupCreateMutationVariables;
};



/*
mutation guestGroupCreateMutation(
  $input: GuestGroupCreateInput!
) {
  guestGroupCreate(input: $input) {
    guestGroup {
      id
      invitationName
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
    "concreteType": "GuestGroupCreatePayload",
    "kind": "LinkedField",
    "name": "guestGroupCreate",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "GuestGroup",
        "kind": "LinkedField",
        "name": "guestGroup",
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
            "name": "invitationName",
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
    "name": "guestGroupCreateMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "guestGroupCreateMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "860527ea4cfcce075e93ab0163f0b63a",
    "id": null,
    "metadata": {},
    "name": "guestGroupCreateMutation",
    "operationKind": "mutation",
    "text": "mutation guestGroupCreateMutation(\n  $input: GuestGroupCreateInput!\n) {\n  guestGroupCreate(input: $input) {\n    guestGroup {\n      id\n      invitationName\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = '15230261aee8aa1440199180d49456fc';
export default node;
