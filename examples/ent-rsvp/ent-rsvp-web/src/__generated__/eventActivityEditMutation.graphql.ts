/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type EventActivityEditInput = {
    eventActivityID: string;
    name?: string | null;
    eventID?: string | null;
    startTime?: unknown | null;
    endTime?: unknown | null;
    location?: string | null;
    description?: string | null;
    inviteAllGuests?: boolean | null;
};
export type eventActivityEditMutationVariables = {
    input: EventActivityEditInput;
};
export type eventActivityEditMutationResponse = {
    readonly eventActivityEdit: {
        readonly eventActivity: {
            readonly id: string;
        };
    };
};
export type eventActivityEditMutation = {
    readonly response: eventActivityEditMutationResponse;
    readonly variables: eventActivityEditMutationVariables;
};



/*
mutation eventActivityEditMutation(
  $input: EventActivityEditInput!
) {
  eventActivityEdit(input: $input) {
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
    "concreteType": "EventActivityEditPayload",
    "kind": "LinkedField",
    "name": "eventActivityEdit",
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
    "name": "eventActivityEditMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "eventActivityEditMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "d15e7f85e7c342c755023d8ae74ff9db",
    "id": null,
    "metadata": {},
    "name": "eventActivityEditMutation",
    "operationKind": "mutation",
    "text": "mutation eventActivityEditMutation(\n  $input: EventActivityEditInput!\n) {\n  eventActivityEdit(input: $input) {\n    eventActivity {\n      id\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = 'b02a1e140a305e1d74247946307adfcd';
export default node;
