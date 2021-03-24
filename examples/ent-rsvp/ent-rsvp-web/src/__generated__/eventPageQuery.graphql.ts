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
            }>;
        };
        readonly guestGroups: {
            readonly edges: ReadonlyArray<{
                readonly node: {
                    readonly id: string;
                    readonly invitationName: string;
                    readonly guests: {
                        readonly rawCount: number;
                        readonly nodes: ReadonlyArray<{
                            readonly id: string;
                            readonly name: string;
                            readonly emailAddress: string | null;
                            readonly title: string | null;
                        }>;
                    };
                    readonly invitedEvents: {
                        readonly nodes: ReadonlyArray<{
                            readonly id: string;
                            readonly name: string;
                        }>;
                    };
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
          inviteAllGuests
          address {
            id
            street
            city
            state
            zipCode
            apartment
          }
          __typename
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
    guestGroups(first: 100) {
      edges {
        node {
          id
          invitationName
          guests {
            rawCount
            nodes {
              id
              name
              emailAddress
              title
            }
          }
          invitedEvents: guestGroupToInvitedEvents(first: 10) {
            nodes {
              id
              name
            }
          }
          __typename
        }
        cursor
      }
      pageInfo {
        endCursor
        hasNextPage
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
v1 = [
  {
    "kind": "Variable",
    "name": "slug",
    "variableName": "slug"
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
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "rawCount",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v7 = {
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
      "name": "endCursor",
      "storageKey": null
    },
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
v8 = [
  (v4/*: any*/),
  {
    "alias": null,
    "args": null,
    "concreteType": "EventToEventActivitiesEdge",
    "kind": "LinkedField",
    "name": "edges",
    "plural": true,
    "selections": [
      (v5/*: any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": "EventActivity",
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
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
          },
          (v6/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  },
  (v7/*: any*/)
],
v9 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 10
  }
],
v10 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "EventToGuestGroupsEdge",
    "kind": "LinkedField",
    "name": "edges",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "GuestGroup",
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
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
              (v4/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Guest",
                "kind": "LinkedField",
                "name": "nodes",
                "plural": true,
                "selections": [
                  (v2/*: any*/),
                  (v3/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "emailAddress",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "title",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": "invitedEvents",
            "args": (v9/*: any*/),
            "concreteType": "GuestGroupToInvitedEventsConnection",
            "kind": "LinkedField",
            "name": "guestGroupToInvitedEvents",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "EventActivity",
                "kind": "LinkedField",
                "name": "nodes",
                "plural": true,
                "selections": [
                  (v2/*: any*/),
                  (v3/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": "guestGroupToInvitedEvents(first:10)"
          },
          (v6/*: any*/)
        ],
        "storageKey": null
      },
      (v5/*: any*/)
    ],
    "storageKey": null
  },
  (v7/*: any*/)
],
v11 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "eventPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Event",
        "kind": "LinkedField",
        "name": "event",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "alias": "eventActivities",
            "args": null,
            "concreteType": "EventToEventActivitiesConnection",
            "kind": "LinkedField",
            "name": "__Event_eventActivities_connection",
            "plural": false,
            "selections": (v8/*: any*/),
            "storageKey": null
          },
          {
            "alias": "guestGroups",
            "args": null,
            "concreteType": "EventToGuestGroupsConnection",
            "kind": "LinkedField",
            "name": "__Event_guestGroups_connection",
            "plural": false,
            "selections": (v10/*: any*/),
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "eventPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Event",
        "kind": "LinkedField",
        "name": "event",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "alias": null,
            "args": (v9/*: any*/),
            "concreteType": "EventToEventActivitiesConnection",
            "kind": "LinkedField",
            "name": "eventActivities",
            "plural": false,
            "selections": (v8/*: any*/),
            "storageKey": "eventActivities(first:10)"
          },
          {
            "alias": null,
            "args": (v9/*: any*/),
            "filters": null,
            "handle": "connection",
            "key": "Event_eventActivities",
            "kind": "LinkedHandle",
            "name": "eventActivities"
          },
          {
            "alias": null,
            "args": (v11/*: any*/),
            "concreteType": "EventToGuestGroupsConnection",
            "kind": "LinkedField",
            "name": "guestGroups",
            "plural": false,
            "selections": (v10/*: any*/),
            "storageKey": "guestGroups(first:100)"
          },
          {
            "alias": null,
            "args": (v11/*: any*/),
            "filters": null,
            "handle": "connection",
            "key": "Event_guestGroups",
            "kind": "LinkedHandle",
            "name": "guestGroups"
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "30538752ea812564d31c4340f29f8b8e",
    "id": null,
    "metadata": {
      "connection": [
        {
          "count": null,
          "cursor": null,
          "direction": "forward",
          "path": [
            "event",
            "eventActivities"
          ]
        },
        {
          "count": null,
          "cursor": null,
          "direction": "forward",
          "path": [
            "event",
            "guestGroups"
          ]
        }
      ]
    },
    "name": "eventPageQuery",
    "operationKind": "query",
    "text": "query eventPageQuery(\n  $slug: String!\n) {\n  event(slug: $slug) {\n    id\n    name\n    eventActivities(first: 10) {\n      rawCount\n      edges {\n        cursor\n        node {\n          id\n          name\n          description\n          startTime\n          endTime\n          location\n          inviteAllGuests\n          address {\n            id\n            street\n            city\n            state\n            zipCode\n            apartment\n          }\n          __typename\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n      }\n    }\n    guestGroups(first: 100) {\n      edges {\n        node {\n          id\n          invitationName\n          guests {\n            rawCount\n            nodes {\n              id\n              name\n              emailAddress\n              title\n            }\n          }\n          invitedEvents: guestGroupToInvitedEvents(first: 10) {\n            nodes {\n              id\n              name\n            }\n          }\n          __typename\n        }\n        cursor\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n      }\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = '05684241b452da19f1ed14d086336f07';
export default node;
