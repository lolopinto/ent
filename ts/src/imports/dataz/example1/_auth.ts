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
    class: "UserAuthInput",
    type: GraphQLString,
  })
  emailAddress: string;
  @gqlField({
    class: "UserAuthInput",
    type: GraphQLString,
  })
  password: string;
}

@gqlObjectType()
class UserAuthResponse {
  @gqlField({
    class: "UserAuthResponse",
    type: GraphQLString,
  })
  token: string;

  @gqlField({ class: "UserAuthResponses", type: GraphQLID })
  viewerID: ID;
}

class AuthResolver {
  @gqlMutation({
    class: "AuthResolver",
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
