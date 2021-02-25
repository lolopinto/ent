/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from "relay-runtime";
import { FragmentRefs } from "relay-runtime";
export type eventFragment = {
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
    readonly " $refType": "eventFragment";
};
export type eventFragment$data = eventFragment;
export type eventFragment$key = {
    readonly " $data"?: eventFragment$data;
    readonly " $fragmentRefs": FragmentRefs<"eventFragment">;
};



const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "eventFragment",
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
    (v1/*: any*/),
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
                (v0/*: any*/),
                (v1/*: any*/),
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
  "type": "Event",
  "abstractKey": null
};
})();
(node as any).hash = 'b614490cb87e52700ad671f1cd816761';
export default node;
