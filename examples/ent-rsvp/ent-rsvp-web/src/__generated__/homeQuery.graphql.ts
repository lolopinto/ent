/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type homeQueryVariables = {};
export type homeQueryResponse = {
    readonly viewer: {
        readonly user: {
            readonly id: string;
            readonly events: {
                readonly edges: ReadonlyArray<{
                    readonly node: {
                        readonly id: string;
                        readonly creator: {
                            readonly id: string;
                            readonly firstName: string;
                        } | null;
                        readonly name: string;
                        readonly eventActivities: {
                            readonly edges: ReadonlyArray<{
                                readonly node: {
                                    readonly id: string;
                                    readonly name: string;
                                    readonly startTime: unknown;
                                    readonly endTime: unknown | null;
                                    readonly location: string;
                                    readonly address: {
                                        readonly id: string;
                                        readonly street: string;
                                        readonly city: string;
                                        readonly state: string;
                                        readonly zipCode: string;
                                        readonly apartment: string | null;
                                    } | null;
                                };
                            }>;
                        };
                    };
                    readonly cursor: string;
                }>;
                readonly pageInfo: {
                    readonly hasNextPage: boolean;
                };
                readonly rawCount: number;
            };
        } | null;
    } | null;
};
export type homeQuery = {
    readonly response: homeQueryResponse;
    readonly variables: homeQueryVariables;
};



/*
query homeQuery {
  viewer {
    user {
      id
      events(first: 10) {
        edges {
          node {
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
          cursor
        }
        pageInfo {
          hasNextPage
        }
        rawCount
      }
    }
  }
}
*/

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 10
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "Viewer",
    "kind": "LinkedField",
    "name": "viewer",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "user",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          {
            "alias": null,
            "args": (v1/*: any*/),
            "concreteType": "UserToEventsConnection",
            "kind": "LinkedField",
            "name": "events",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "UserToEventsEdge",
                "kind": "LinkedField",
                "name": "edges",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Event",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": [
                      (v0/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "User",
                        "kind": "LinkedField",
                        "name": "creator",
                        "plural": false,
                        "selections": [
                          (v0/*: any*/),
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
                      (v2/*: any*/),
                      {
                        "alias": null,
                        "args": (v1/*: any*/),
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
                                  (v0/*: any*/),
                                  (v2/*: any*/),
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
                                      (v0/*: any*/),
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
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "cursor",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "PageInfo",
                "kind": "LinkedField",
                "name": "pageInfo",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "hasNextPage",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "rawCount",
                "storageKey": null
              }
            ],
            "storageKey": "events(first:10)"
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
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "homeQuery",
    "selections": (v3/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "homeQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "0af07d680607537f7b0bddaa7b8ab5b4",
    "id": null,
    "metadata": {},
    "name": "homeQuery",
    "operationKind": "query",
    "text": "query homeQuery {\n  viewer {\n    user {\n      id\n      events(first: 10) {\n        edges {\n          node {\n            id\n            creator {\n              id\n              firstName\n            }\n            name\n            eventActivities(first: 10) {\n              edges {\n                node {\n                  id\n                  name\n                  startTime\n                  endTime\n                  location\n                  address {\n                    id\n                    street\n                    city\n                    state\n                    zipCode\n                    apartment\n                  }\n                }\n              }\n            }\n          }\n          cursor\n        }\n        pageInfo {\n          hasNextPage\n        }\n        rawCount\n      }\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = '2c7c744ffb4b3f1b23eb158cf518acbb';
export default node;
