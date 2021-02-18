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
            readonly id: string;
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
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "userCreateMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "userCreateMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "ea5f216ebdc6835b74254d373b6d3bee",
    "id": null,
    "metadata": {},
    "name": "userCreateMutation",
    "operationKind": "mutation",
    "text": "mutation userCreateMutation(\n  $input: UserCreateInput!\n) {\n  userCreate(input: $input) {\n    user {\n      id\n    }\n  }\n}\n"
  }
};
})();
(node as any).hash = '0b3fddf9252345c0f16a72a5ec88c741';
export default node;
