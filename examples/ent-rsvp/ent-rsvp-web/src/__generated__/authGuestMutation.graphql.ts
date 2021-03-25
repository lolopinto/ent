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
            } | null;
            readonly user: {
                readonly id: string;
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
      }
      user {
        id
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
    "args": null,
    "kind": "ScalarField",
    "name": "id",
    "storageKey": null
  }
],
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
            "selections": (v1/*: any*/),
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "user",
            "plural": false,
            "selections": (v1/*: any*/),
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
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "authGuestMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "38a5c370e997c72ab83089a20199c44c",
    "id": null,
    "metadata": {},
    "name": "authGuestMutation",
    "operationKind": "mutation",
    "text": "mutation authGuestMutation(\n  $input: AuthGuestInput!\n) {\n  authGuest(input: $input) {\n    viewer {\n      guest {\n        id\n      }\n      user {\n        id\n      }\n    }\n    token\n  }\n}\n"
  }
};
})();
(node as any).hash = 'fd065e2ae292552615c259823ef6be17';
export default node;
