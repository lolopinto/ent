import {
  gqlInputObjectType,
  gqlField,
  gqlMutation,
  gqlObjectType,
} from "../../../graphql/graphql";
import { ID } from "../../../core/base";
import { GraphQLID, GraphQLString } from "graphql";

@gqlInputObjectType()
class UserAuthInput {
  @gqlField({
    nodeName: "UserAuthInput",
    type: GraphQLString,
  })
  emailAddress: string;
  @gqlField({
    nodeName: "UserAuthInput",
    type: GraphQLString,
  })
  password: string;
}

@gqlObjectType()
class UserAuthResponse {
  @gqlField({
    nodeName: "UserAuthResponse",
    type: GraphQLString,
  })
  token: string;

  @gqlField({ nodeName: "UserAuthResponses", type: GraphQLID })
  viewerID: ID;
}

class AuthResolver {
  @gqlMutation({
    nodeName: "AuthResolver",
    name: "userAuth",
    type: UserAuthResponse,
    args: [
      {
        name: "input",
        type: UserAuthInput,
      },
    ],
  })
  async userAuth(input: UserAuthInput): Promise<UserAuthResponse> {
    throw new Error("not implemented");
  }
}
