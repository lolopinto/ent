/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type rsvpPageQueryVariables = {
    slug: string;
};
export type rsvpPageQueryResponse = {
    readonly event: {
        readonly id: string;
    } | null;
    readonly viewer: {
        readonly guest: {
            readonly guestGroup: {
                readonly invitedActivities: {
                    readonly nodes: ReadonlyArray<{
                        readonly id: string;
                        readonly name: string;
                        readonly description: string | null;
                        readonly startTime: unknown;
                        readonly endTime: unknown | null;
                        readonly location: string;
                        readonly event: {
                            readonly id: string;
                        } | null;
                        readonly address: {
                            readonly id: string;
                            readonly street: string;
                            readonly city: string;
                            readonly state: string;
                            readonly zipCode: string;
                            readonly apartment: string | null;
                        } | null;
                    }>;
                };
                readonly guests: {
                    readonly nodes: ReadonlyArray<{
                        readonly id: string;
                        readonly name: string;
                        readonly emailAddress: string | null;
                        readonly title: string | null;
                        readonly attending: {
                            readonly edges: ReadonlyArray<{
                                readonly node: {
                                    readonly id: string;
                                };
                                readonly dietaryRestrictions: string | null;
                            }>;
                        };
                        readonly declined: {
                            readonly nodes: ReadonlyArray<{
                                readonly id: string;
                            }>;
                        };
                    }>;
                };
            } | null;
        } | null;
    } | null;
};
export type rsvpPageQuery = {
    readonly response: rsvpPageQueryResponse;
    readonly variables: rsvpPageQueryVariables;
};



/*
query rsvpPageQuery(
  $slug: String!
) {
  event(slug: $slug) {
    id
  }
  viewer {
    guest {
      guestGroup {
        invitedActivities: guestGroupToInvitedEvents(first: 100) {
          nodes {
            id
            name
            description
            startTime
            endTime
            location
            event {
              id
            }
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
        guests {
          nodes {
            id
            name
            emailAddress
            title
            attending: guestToAttendingEvents {
              edges {
                node {
                  id
                }
                dietaryRestrictions
              }
            }
            declined: guestToDeclinedEvents {
              nodes {
                id
              }
            }
          }
        }
        id
      }
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
v2 = [
  (v1/*: any*/)
],
v3 = {
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
  "selections": (v2/*: any*/),
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": "invitedActivities",
  "args": [
    {
      "kind": "Literal",
      "name": "first",
      "value": 100
    }
  ],
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
        (v1/*: any*/),
        (v4/*: any*/),
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
          "concreteType": "Event",
          "kind": "LinkedField",
          "name": "event",
          "plural": false,
          "selections": (v2/*: any*/),
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
  "storageKey": "guestGroupToInvitedEvents(first:100)"
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "GuestGroupToGuestsConnection",
  "kind": "LinkedField",
  "name": "guests",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "Guest",
      "kind": "LinkedField",
      "name": "nodes",
      "plural": true,
      "selections": [
        (v1/*: any*/),
        (v4/*: any*/),
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
        },
        {
          "alias": "attending",
          "args": null,
          "concreteType": "GuestToAttendingEventsConnection",
          "kind": "LinkedField",
          "name": "guestToAttendingEvents",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "GuestToAttendingEventsEdge",
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
                  "selections": (v2/*: any*/),
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "dietaryRestrictions",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": "declined",
          "args": null,
          "concreteType": "GuestToDeclinedEventsConnection",
          "kind": "LinkedField",
          "name": "guestToDeclinedEvents",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "EventActivity",
              "kind": "LinkedField",
              "name": "nodes",
              "plural": true,
              "selections": (v2/*: any*/),
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "rsvpPageQuery",
    "selections": [
      (v3/*: any*/),
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
            "concreteType": "Guest",
            "kind": "LinkedField",
            "name": "guest",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "GuestGroup",
                "kind": "LinkedField",
                "name": "guestGroup",
                "plural": false,
                "selections": [
                  (v5/*: any*/),
                  (v6/*: any*/)
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
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "rsvpPageQuery",
    "selections": [
      (v3/*: any*/),
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
            "concreteType": "Guest",
            "kind": "LinkedField",
            "name": "guest",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "GuestGroup",
                "kind": "LinkedField",
                "name": "guestGroup",
                "plural": false,
                "selections": [
                  (v5/*: any*/),
                  (v6/*: any*/),
                  (v1/*: any*/)
                ],
                "storageKey": null
              },
              (v1/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "f21e4a3b0ce860c1fc89f3e8dd1a4ecd",
    "id": null,
    "metadata": {},
    "name": "rsvpPageQuery",
    "operationKind": "query",
    "text": "query rsvpPageQuery(\n  $slug: String!\n) {\n  event(slug: $slug) {\n    id\n  }\n  viewer {\n    guest {\n      guestGroup {\n        invitedActivities: guestGroupToInvitedEvents(first: 100) {\n          nodes {\n            id\n            name\n            description\n            startTime\n            endTime\n            location\n            event {\n              id\n            }\n            address {\n              id\n              street\n              city\n              state\n              zipCode\n              apartment\n            }\n          }\n        }\n        guests {\n          nodes {\n            id\n            name\n            emailAddress\n            title\n            attending: guestToAttendingEvents {\n              edges {\n                node {\n                  id\n                }\n                dietaryRestrictions\n              }\n            }\n            declined: guestToDeclinedEvents {\n              nodes {\n                id\n              }\n            }\n          }\n        }\n        id\n      }\n      id\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = 'c7c7179c0f2e21005fee06deef34ff06';
export default node;
