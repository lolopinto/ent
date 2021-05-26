/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type eventSlugAvailableQueryVariables = {
    slug: string;
};
export type eventSlugAvailableQueryResponse = {
    readonly eventSlugAvailable: boolean;
};
export type eventSlugAvailableQuery = {
    readonly response: eventSlugAvailableQueryResponse;
    readonly variables: eventSlugAvailableQueryVariables;
};



/*
query eventSlugAvailableQuery(
  $slug: String!
) {
  eventSlugAvailable(slug: $slug)
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
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "slug",
        "variableName": "slug"
      }
    ],
    "kind": "ScalarField",
    "name": "eventSlugAvailable",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "eventSlugAvailableQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "eventSlugAvailableQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "7cd7e4d5c0a3d27cea0d0cc945c7dcad",
    "id": null,
    "metadata": {},
    "name": "eventSlugAvailableQuery",
    "operationKind": "query",
    "text": "query eventSlugAvailableQuery(\n  $slug: String!\n) {\n  eventSlugAvailable(slug: $slug)\n}\n"
  }
};
})();
(node as any).hash = 'c25cfff41cf4da24d26895ebbfa771e5';
export default node;
