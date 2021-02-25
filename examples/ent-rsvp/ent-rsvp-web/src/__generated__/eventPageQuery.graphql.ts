/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type eventPageQueryVariables = {
    slug: string;
};
export type eventPageQueryResponse = {
    readonly eventt: {
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
  eventt(slug: $slug) {
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
v3 = [
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
    "name": "eventt",
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "rawCount",
            "storageKey": null
          },
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
    "selections": (v3/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "eventPageQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "fc8916a5532d91c06ea3fae062ac5de5",
    "id": null,
    "metadata": {},
    "name": "eventPageQuery",
    "operationKind": "query",
    "text": "query eventPageQuery(\n  $slug: String!\n) {\n  eventt(slug: $slug) {\n    id\n    name\n    eventActivities(first: 10) {\n      rawCount\n      edges {\n        cursor\n        node {\n          id\n          name\n          description\n          startTime\n          endTime\n          location\n          address {\n            id\n            street\n            city\n            state\n            zipCode\n            apartment\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = 'a27930b2ef19cff9193c6e06dbedb17a';
export default node;
