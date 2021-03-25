/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type EventActivityRsvpStatusInput = "ATTENDING" | "DECLINED" | "%future added value";
export type EventActivityRsvpStatusEditInput = {
    eventActivityID: string;
    rsvpStatus: EventActivityRsvpStatusInput;
    guestID: string;
    dietaryRestrictions?: string | null;
};
export type eventActivityRsvpStatusEditMutationVariables = {
    input: EventActivityRsvpStatusEditInput;
};
export type eventActivityRsvpStatusEditMutationResponse = {
    readonly eventActivityRsvpStatusEdit: {
        readonly eventActivity: {
            readonly id: string;
        };
    };
};
export type eventActivityRsvpStatusEditMutation = {
    readonly response: eventActivityRsvpStatusEditMutationResponse;
    readonly variables: eventActivityRsvpStatusEditMutationVariables;
};



/*
mutation eventActivityRsvpStatusEditMutation(
  $input: EventActivityRsvpStatusEditInput!
) {
  eventActivityRsvpStatusEdit(input: $input) {
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
    "concreteType": "EventActivityRsvpStatusEditPayload",
    "kind": "LinkedField",
    "name": "eventActivityRsvpStatusEdit",
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
    "name": "eventActivityRsvpStatusEditMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "eventActivityRsvpStatusEditMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "689629479d9e8d6b46e89fb9e7e247d8",
    "id": null,
    "metadata": {},
    "name": "eventActivityRsvpStatusEditMutation",
    "operationKind": "mutation",
    "text": "mutation eventActivityRsvpStatusEditMutation(\n  $input: EventActivityRsvpStatusEditInput!\n) {\n  eventActivityRsvpStatusEdit(input: $input) {\n    eventActivity {\n      id\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = '2dd7c81191518c3f5cec5572d5c2b689';
export default node;
