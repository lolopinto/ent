/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type EventActivityDeleteInput = {
    eventActivityID: string;
};
export type eventActivityDeleteMutationVariables = {
    input: EventActivityDeleteInput;
};
export type eventActivityDeleteMutationResponse = {
    readonly eventActivityDelete: {
        readonly deletedEventActivityID: string | null;
    };
};
export type eventActivityDeleteMutation = {
    readonly response: eventActivityDeleteMutationResponse;
    readonly variables: eventActivityDeleteMutationVariables;
};



/*
mutation eventActivityDeleteMutation(
  $input: EventActivityDeleteInput!
) {
  eventActivityDelete(input: $input) {
    deletedEventActivityID
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
    "concreteType": "EventActivityDeletePayload",
    "kind": "LinkedField",
    "name": "eventActivityDelete",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "deletedEventActivityID",
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
    "name": "eventActivityDeleteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "eventActivityDeleteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "5bda678405ecc0e0f0445f5a621d0b65",
    "id": null,
    "metadata": {},
    "name": "eventActivityDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation eventActivityDeleteMutation(\n  $input: EventActivityDeleteInput!\n) {\n  eventActivityDelete(input: $input) {\n    deletedEventActivityID\n  }\n}\n"
  }
};
})();
(node as any).hash = '8e56b6deff0e18363d400c380a40e023';
export default node;
