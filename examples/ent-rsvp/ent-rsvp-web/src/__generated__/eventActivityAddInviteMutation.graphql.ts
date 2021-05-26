/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type EventActivityAddInviteInput = {
    eventActivityID: string;
    inviteID: string;
};
export type eventActivityAddInviteMutationVariables = {
    input: EventActivityAddInviteInput;
};
export type eventActivityAddInviteMutationResponse = {
    readonly eventActivityAddInvite: {
        readonly eventActivity: {
            readonly id: string;
        };
    };
};
export type eventActivityAddInviteMutation = {
    readonly response: eventActivityAddInviteMutationResponse;
    readonly variables: eventActivityAddInviteMutationVariables;
};



/*
mutation eventActivityAddInviteMutation(
  $input: EventActivityAddInviteInput!
) {
  eventActivityAddInvite(input: $input) {
    eventActivity {
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
    "concreteType": "EventActivityAddInvitePayload",
    "kind": "LinkedField",
    "name": "eventActivityAddInvite",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "EventActivity",
        "kind": "LinkedField",
        "name": "eventActivity",
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
    "name": "eventActivityAddInviteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "eventActivityAddInviteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "1b4e92c4a650ae02c344c5169f57e361",
    "id": null,
    "metadata": {},
    "name": "eventActivityAddInviteMutation",
    "operationKind": "mutation",
    "text": "mutation eventActivityAddInviteMutation(\n  $input: EventActivityAddInviteInput!\n) {\n  eventActivityAddInvite(input: $input) {\n    eventActivity {\n      id\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = '9598d8c6766c8f87364ef77c9ac672da';
export default node;
