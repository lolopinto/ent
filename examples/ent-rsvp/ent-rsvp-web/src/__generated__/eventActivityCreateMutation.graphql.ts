/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type EventActivityCreateInput = {
    name: string;
    eventID: string;
    startTime: unknown;
    endTime?: unknown | null;
    location: string;
    description?: string | null;
    inviteAllGuests?: boolean | null;
    address?: AddressEventActivityCreateInput | null;
};
export type AddressEventActivityCreateInput = {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    apartment?: string | null;
};
export type eventActivityCreateMutationVariables = {
    input: EventActivityCreateInput;
};
export type eventActivityCreateMutationResponse = {
    readonly eventActivityCreate: {
        readonly eventActivity: {
            readonly id: string;
            readonly name: string;
            readonly startTime: unknown;
            readonly endTime: unknown | null;
            readonly location: string;
            readonly inviteAllGuests: boolean;
            readonly address: {
                readonly id: string;
                readonly street: string;
                readonly city: string;
                readonly state: string;
                readonly zipCode: string;
                readonly apartment: string | null;
            } | null;
        };
    };
};
export type eventActivityCreateMutation = {
    readonly response: eventActivityCreateMutationResponse;
    readonly variables: eventActivityCreateMutationVariables;
};



/*
mutation eventActivityCreateMutation(
  $input: EventActivityCreateInput!
) {
  eventActivityCreate(input: $input) {
    eventActivity {
      id
      name
      startTime
      endTime
      location
      inviteAllGuests
      address {
        id
        street
        city
        state
        zipCode
        apartment
      }
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
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "EventActivityCreatePayload",
    "kind": "LinkedField",
    "name": "eventActivityCreate",
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
          (v1/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "name",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "startTime",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "endTime",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "location",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "inviteAllGuests",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "Address",
            "kind": "LinkedField",
            "name": "address",
            "plural": false,
            "selections": [
              (v1/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "street",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "city",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "state",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "zipCode",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "apartment",
                "storageKey": null
              }
            ],
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
    "name": "eventActivityCreateMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "eventActivityCreateMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "7202c2e69fc109a244e8aa10b3bb9b0c",
    "id": null,
    "metadata": {},
    "name": "eventActivityCreateMutation",
    "operationKind": "mutation",
    "text": "mutation eventActivityCreateMutation(\n  $input: EventActivityCreateInput!\n) {\n  eventActivityCreate(input: $input) {\n    eventActivity {\n      id\n      name\n      startTime\n      endTime\n      location\n      inviteAllGuests\n      address {\n        id\n        street\n        city\n        state\n        zipCode\n        apartment\n      }\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = 'b5e597c6f2ed3464426ddcbaefd8e233';
export default node;
