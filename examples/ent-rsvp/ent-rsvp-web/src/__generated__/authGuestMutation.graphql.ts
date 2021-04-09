/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type AuthGuestInput = {
    emailAddress: string;
    code: string;
};
export type authGuestMutationVariables = {
    input: AuthGuestInput;
};
export type authGuestMutationResponse = {
    readonly authGuest: {
        readonly viewer: {
            readonly guest: {
                readonly id: string;
                readonly emailAddress: string | null;
            } | null;
        };
        readonly token: string;
    };
};
export type authGuestMutation = {
    readonly response: authGuestMutationResponse;
    readonly variables: authGuestMutationVariables;
};



/*
mutation authGuestMutation(
  $input: AuthGuestInput!
) {
  authGuest(input: $input) {
    viewer {
      guest {
        id
        emailAddress
      }
    }
    token
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
    "concreteType": "AuthGuestPayload",
    "kind": "LinkedField",
    "name": "authGuest",
    "plural": false,
    "selections": [
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
                "kind": "ScalarField",
                "name": "id",
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
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "token",
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
    "name": "authGuestMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "authGuestMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "de343d7d84a9de9aaa28be878f365a12",
    "id": null,
    "metadata": {},
    "name": "authGuestMutation",
    "operationKind": "mutation",
    "text": "mutation authGuestMutation(\n  $input: AuthGuestInput!\n) {\n  authGuest(input: $input) {\n    viewer {\n      guest {\n        id\n        emailAddress\n      }\n    }\n    token\n  }\n}\n"
  }
};
})();
(node as any).hash = '41027ed37a05f77166081df529f53df7';
export default node;
