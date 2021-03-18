/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type eventPageQueryVariables = {
    slug: string;
};
export type eventPageQueryResponse = {
    readonly event: {
        readonly id: string;
        readonly name: string;
        readonly eventActivities: {
            readonly rawCount: number;
            readonly edges: ReadonlyArray<{
                readonly cursor: string;
                readonly node: {
                    readonly id: string;
                    readonly name: string;
                    readonly description: string | null;
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
        readonly guestGroups: {
            readonly nodes: ReadonlyArray<{
                readonly id: string;
                readonly invitationName: string;
                readonly guests: {
                    readonly rawCount: number;
                    readonly nodes: ReadonlyArray<{
                        readonly id: string;
                        readonly firstName: string;
                        readonly lastName: string;
                        readonly emailAddress: string;
                    }>;
                };
            }>;
        };
    } | null;
};
export type eventPageQuery = {
    readonly response: eventPageQueryResponse;
    readonly variables: eventPageQueryVariables;
};



/*
query eventPageQuery(
  $slug: String!
) {
  event(slug: $slug) {
    id
    name
    eventActivities(first: 10) {
      rawCount
      edges {
        cursor
        node {
          id
          name
          description
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
    guestGroups(first: 100) {
      nodes {
        id
        invitationName
        guests {
          rawCount
          nodes {
            id
            firstName
            lastName
            emailAddress
          }
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
    "name": "slug"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "rawCount",
  "storageKey": null
},
v4 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "slug",
        "variableName": "slug"
      }
    ],
    "concreteType": "Event",
    "kind": "LinkedField",
    "name": "event",
    "plural": false,
    "selections": [
      (v1/*: any*/),
      (v2/*: any*/),
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
          (v3/*: any*/),
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
                "kind": "ScalarField",
                "name": "cursor",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "EventActivity",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v1/*: any*/),
                  (v2/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "description",
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
        ],
        "storageKey": "eventActivities(first:10)"
      },
      {
        "alias": null,
        "args": [
          {
            "kind": "Literal",
            "name": "first",
            "value": 100
          }
        ],
        "concreteType": "EventToGuestGroupsConnection",
        "kind": "LinkedField",
        "name": "guestGroups",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "GuestGroup",
            "kind": "LinkedField",
            "name": "nodes",
            "plural": true,
            "selections": [
              (v1/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "invitationName",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "GuestGroupToGuestsConnection",
                "kind": "LinkedField",
                "name": "guests",
                "plural": false,
                "selections": [
                  (v3/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Guest",
                    "kind": "LinkedField",
                    "name": "nodes",
                    "plural": true,
                    "selections": [
                      (v1/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "firstName",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "lastName",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "emailAddress",
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
        "storageKey": "guestGroups(first:100)"
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
    "name": "eventPageQuery",
    "selections": (v4/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "eventPageQuery",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "465b05f64b4757dfcd73bd7f735546b2",
    "id": null,
    "metadata": {},
    "name": "eventPageQuery",
    "operationKind": "query",
    "text": "query eventPageQuery(\n  $slug: String!\n) {\n  event(slug: $slug) {\n    id\n    name\n    eventActivities(first: 10) {\n      rawCount\n      edges {\n        cursor\n        node {\n          id\n          name\n          description\n          startTime\n          endTime\n          location\n          address {\n            id\n            street\n            city\n            state\n            zipCode\n            apartment\n          }\n        }\n      }\n    }\n    guestGroups(first: 100) {\n      nodes {\n        id\n        invitationName\n        guests {\n          rawCount\n          nodes {\n            id\n            firstName\n            lastName\n            emailAddress\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = '488be396cfdbc19577717e918f467b4f';
export default node;
