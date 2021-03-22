/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type importGuestsMutationVariables = {
    eventID: string;
    file: unknown;
};
export type importGuestsMutationResponse = {
    readonly importGuests: {
        readonly id: string;
    };
};
export type importGuestsMutation = {
    readonly response: importGuestsMutationResponse;
    readonly variables: importGuestsMutationVariables;
};



/*
mutation importGuestsMutation(
  $eventID: ID!
  $file: Upload!
) {
  importGuests(eventID: $eventID, file: $file) {
    id
  }
}
*/

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "eventID"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "file"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "eventID",
        "variableName": "eventID"
      },
      {
        "kind": "Variable",
        "name": "file",
        "variableName": "file"
      }
    ],
    "concreteType": "Event",
    "kind": "LinkedField",
    "name": "importGuests",
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "importGuestsMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "importGuestsMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "95e1bb647c6fbd93b1de6672cc4d87a4",
    "id": null,
    "metadata": {},
    "name": "importGuestsMutation",
    "operationKind": "mutation",
    "text": "mutation importGuestsMutation(\n  $eventID: ID!\n  $file: Upload!\n) {\n  importGuests(eventID: $eventID, file: $file) {\n    id\n  }\n}\n"
  }
};
})();
(node as any).hash = 'f669357f0e1eadfe5e2cd98d47164358';
export default node;
