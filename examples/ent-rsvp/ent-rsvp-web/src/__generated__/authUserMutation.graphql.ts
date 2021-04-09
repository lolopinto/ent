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
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
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
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "authUserMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "1a8e8d5f419d8a02e1459f702b84453c",
    "id": null,
    "metadata": {},
    "name": "authUserMutation",
    "operationKind": "mutation",
    "text": "mutation authUserMutation(\n  $input: AuthUserInput!\n) {\n  authUser(input: $input) {\n    viewer {\n      user {\n        id\n      }\n    }\n    token\n  }\n}\n"
  }
};
})();
(node as any).hash = '948ec2469fd5f8f4615bb9829d5e29ed';
export default node;
