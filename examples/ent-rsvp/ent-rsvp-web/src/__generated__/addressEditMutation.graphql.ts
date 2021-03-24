/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type AddressEditInput = {
    addressID: string;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    apartment?: string | null;
    ownerID?: string | null;
    ownerType?: string | null;
};
export type addressEditMutationVariables = {
    input: AddressEditInput;
};
export type addressEditMutationResponse = {
    readonly addressEdit: {
        readonly address: {
            readonly id: string;
        };
    };
};
export type addressEditMutation = {
    readonly response: addressEditMutationResponse;
    readonly variables: addressEditMutationVariables;
};



/*
mutation addressEditMutation(
  $input: AddressEditInput!
) {
  addressEdit(input: $input) {
    address {
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
    "concreteType": "AddressEditPayload",
    "kind": "LinkedField",
    "name": "addressEdit",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Address",
        "kind": "LinkedField",
        "name": "address",
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
    "name": "addressEditMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "addressEditMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "d2e2fd9b0cc2e12982e095a38144d695",
    "id": null,
    "metadata": {},
    "name": "addressEditMutation",
    "operationKind": "mutation",
    "text": "mutation addressEditMutation(\n  $input: AddressEditInput!\n) {\n  addressEdit(input: $input) {\n    address {\n      id\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = '8c3290495487e90887e3d663f847c205';
export default node;
