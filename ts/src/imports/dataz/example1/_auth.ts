import {
  gqlInputObjectType,
  gqlField,
  gqlMutation,
  gqlArg,
  gqlObjectType,
} from "../../../graphql/graphql";
import { ID } from "../../../core/base";
import { GraphQLID } from "graphql";

@gqlInputObjectType()
class UserAuthInput {
  @gqlField()
  emailAddress: string;
  @gqlField()
  password: string;
}

@gqlObjectType()
class UserAuthResponse {
  @gqlField()
  token: string;

  @gqlField({ type: GraphQLID })
  viewerID: ID;
}

class AuthResolver {
  @gqlMutation({ name: "userAuth", type: UserAuthResponse })
  async userAuth(
    @gqlArg("input") input: UserAuthInput,
  ): Promise<UserAuthResponse> {
    throw new Error("not implemented");
  }
}
