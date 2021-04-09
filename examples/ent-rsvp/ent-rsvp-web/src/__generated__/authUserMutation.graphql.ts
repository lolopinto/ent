/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type AuthUserInput = {
    emailAddress: string;
    password: string;
};
export type authUserMutationVariables = {
    input: AuthUserInput;
};
export type authUserMutationResponse = {
    readonly authUser: {
        readonly viewer: {
            readonly user: {
                readonly id: string;
            } | null;
            readonly guest: {
                readonly id: string;
                readonly emailAddress: string | null;
            } | null;
        };
        readonly token: string;
    };
};
export type authUserMutation = {
    readonly response: authUserMutationResponse;
    readonly variables: authUserMutationVariables;
};



/*
mutation authUserMutation(
  $input: AuthUserInput!
) {
  authUser(input: $input) {
    viewer {
      user {
        id
      }
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
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
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
    "concreteType": "AuthUserPayload",
    "kind": "LinkedField",
    "name": "authUser",
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
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "user",
            "plural": false,
            "selections": [
              (v1/*: any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "Guest",
            "kind": "LinkedField",
            "name": "guest",
            "plural": false,
            "selections": [
              (v1/*: any*/),
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
    "name": "authUserMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "authUserMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "4d7429f350ca2c65dce5ceb9c33ea325",
    "id": null,
    "metadata": {},
    "name": "authUserMutation",
    "operationKind": "mutation",
    "text": "mutation authUserMutation(\n  $input: AuthUserInput!\n) {\n  authUser(input: $input) {\n    viewer {\n      user {\n        id\n      }\n      guest {\n        id\n        emailAddress\n      }\n    }\n    token\n  }\n}\n"
  }
};
})();
(node as any).hash = '5839203c8bbdcf0253db171f00132905';
export default node;
