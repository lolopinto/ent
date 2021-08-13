/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
import { FragmentRefs } from "relay-runtime";
export type EventCreateInput = {
    name: string;
    slug?: string | null;
    activities?: Array<ActivityEventCreateInput> | null;
};
export type ActivityEventCreateInput = {
    name: string;
    startTime: unknown;
    endTime?: unknown | null;
    location: string;
    description?: string | null;
    inviteAllGuests: boolean;
    address?: AddressEventActivityCreateInput | null;
};
export type AddressEventActivityCreateInput = {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    apartment?: string | null;
};
export type eventCreateMutationVariables = {
    input: EventCreateInput;
};
export type eventCreateMutationResponse = {
    readonly eventCreate: {
        readonly event: {
            readonly id: string;
            readonly slug: string | null;
            readonly " $fragmentRefs": FragmentRefs<"eventFragment">;
        };
    };
};
export type eventCreateMutation = {
    readonly response: eventCreateMutationResponse;
    readonly variables: eventCreateMutationVariables;
};



/*
mutation eventCreateMutation(
  $input: EventCreateInput!
) {
  eventCreate(input: $input) {
    event {
      id
      slug
      ...eventFragment
    }
  }
}

fragment eventFragment on Event {
  id
  creator {
    id
    firstName
  }
  name
  eventActivities(first: 10) {
    edges {
      node {
        id
        name
        startTime
        endTime
        location
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
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "slug",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "eventCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "EventCreatePayload",
        "kind": "LinkedField",
        "name": "eventCreate",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Event",
            "kind": "LinkedField",
            "name": "event",
            "plural": false,
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/),
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "eventFragment"
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "eventCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "EventCreatePayload",
        "kind": "LinkedField",
        "name": "eventCreate",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Event",
            "kind": "LinkedField",
            "name": "event",
            "plural": false,
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "creator",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "firstName",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v4/*: any*/),
              {
                "alias": null,
                "args": [
                  {
                    "kind": "Literal",
                    "name": "first",
                    "value": 10
                  }
                ],
                "concreteType": "EventToEventActivitiesConnection",
                "kind": "LinkedField",
                "name": "eventActivities",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "EventToEventActivitiesEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "EventActivity",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v2/*: any*/),
                          (v4/*: any*/),
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
                            "concreteType": "Address",
                            "kind": "LinkedField",
                            "name": "address",
                            "plural": false,
                            "selections": [
                              (v2/*: any*/),
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
                ],
                "storageKey": "eventActivities(first:10)"
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "99e28568fbaa22b919a88f7ac0c5cd7b",
    "id": null,
    "metadata": {},
    "name": "eventCreateMutation",
    "operationKind": "mutation",
    "text": "mutation eventCreateMutation(\n  $input: EventCreateInput!\n) {\n  eventCreate(input: $input) {\n    event {\n      id\n      slug\n      ...eventFragment\n    }\n  }\n}\n\nfragment eventFragment on Event {\n  id\n  creator {\n    id\n    firstName\n  }\n  name\n  eventActivities(first: 10) {\n    edges {\n      node {\n        id\n        name\n        startTime\n        endTime\n        location\n        address {\n          id\n          street\n          city\n          state\n          zipCode\n          apartment\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = 'de3f5568396d6a4cc4fe27f952235b1e';
export default node;
