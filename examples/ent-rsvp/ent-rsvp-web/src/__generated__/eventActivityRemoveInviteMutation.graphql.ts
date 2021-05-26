/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type EventActivityRemoveInviteInput = {
    eventActivityID: string;
    inviteID: string;
};
export type eventActivityRemoveInviteMutationVariables = {
    input: EventActivityRemoveInviteInput;
};
export type eventActivityRemoveInviteMutationResponse = {
    readonly eventActivityRemoveInvite: {
        readonly eventActivity: {
            readonly id: string;
        };
    };
};
export type eventActivityRemoveInviteMutation = {
    readonly response: eventActivityRemoveInviteMutationResponse;
    readonly variables: eventActivityRemoveInviteMutationVariables;
};



/*
mutation eventActivityRemoveInviteMutation(
  $input: EventActivityRemoveInviteInput!
) {
  eventActivityRemoveInvite(input: $input) {
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
    "concreteType": "EventActivityRemoveInvitePayload",
    "kind": "LinkedField",
    "name": "eventActivityRemoveInvite",
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
    "name": "eventActivityRemoveInviteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "eventActivityRemoveInviteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "22a1cf81ab501d7c1586be855983b000",
    "id": null,
    "metadata": {},
    "name": "eventActivityRemoveInviteMutation",
    "operationKind": "mutation",
    "text": "mutation eventActivityRemoveInviteMutation(\n  $input: EventActivityRemoveInviteInput!\n) {\n  eventActivityRemoveInvite(input: $input) {\n    eventActivity {\n      id\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = 'c739ee6c74b4c6dc62ca861e038060d6';
export default node;
