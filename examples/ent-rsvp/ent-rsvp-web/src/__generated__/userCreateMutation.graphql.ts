/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type UserCreateInput = {
    firstName: string;
    lastName: string;
    emailAddress: string;
    password: string;
};
export type userCreateMutationVariables = {
    input: UserCreateInput;
};
export type userCreateMutationResponse = {
    readonly userCreate: {
        readonly user: {
            readonly firstName: string;
            readonly lastName: string;
            readonly emailAddress: string;
        };
    };
};
export type userCreateMutation = {
    readonly response: userCreateMutationResponse;
    readonly variables: userCreateMutationVariables;
};



/*
mutation userCreateMutation(
  $input: UserCreateInput!
) {
  userCreate(input: $input) {
    user {
      firstName
      lastName
      emailAddress
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
    "name": "input"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "firstName",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lastName",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "emailAddress",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "userCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "UserCreatePayload",
        "kind": "LinkedField",
        "name": "userCreate",
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
              (v2/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "userCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "UserCreatePayload",
        "kind": "LinkedField",
        "name": "userCreate",
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
              (v2/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
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
      }
    ]
  },
  "params": {
    "cacheID": "75f2773e53528c9e2c71702d750e87e9",
    "id": null,
    "metadata": {},
    "name": "userCreateMutation",
    "operationKind": "mutation",
    "text": "mutation userCreateMutation(\n  $input: UserCreateInput!\n) {\n  userCreate(input: $input) {\n    user {\n      firstName\n      lastName\n      emailAddress\n      id\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = '4f8eeda6b3353b16c391c08c4d58adf2';
export default node;
