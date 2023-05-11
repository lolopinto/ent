import {
  gqlInputObjectType,
  gqlField,
  gqlMutation,
  gqlContextType,
  gqlObjectType,
  encodeGQLID,
} from "@snowtop/ent/graphql";
import { ID, RequestContext } from "@snowtop/ent";
import { GraphQLID, GraphQLString } from "graphql";
import { useAndVerifyAuth, useAndVerifyAuthJWT } from "@snowtop/ent-passport";
import { User } from "../../ent";

@gqlInputObjectType()
// we're going to test exporting UserAuthInput types
// and not exporting JWT versions
export class UserAuthInput {
  @gqlField({
    class: "UserAuthInput",
    type: GraphQLString,
  })
  emailAddress: string = "";
  @gqlField({
    class: "UserAuthInput",
    type: GraphQLString,
  })
  password: string = "";
}

@gqlInputObjectType()
class UserAuthJWTInput {
  @gqlField({
    class: "UserAuthJWTInput",
    type: GraphQLString,
  })
  emailAddress: string = "";
  @gqlField({
    class: "UserAuthJWTInput",
    type: GraphQLString,
  })
  password: string = "";
}

@gqlObjectType()
export class UserAuthPayload {
  @gqlField({
    class: "UserAuthPayload",
    type: GraphQLID,
  })
  viewerID: ID = "";
}

// TODO abstract classes..

@gqlObjectType()
class UserAuthJWTPayload {
  @gqlField({
    class: "UserAuthJWTPayload",
    type: GraphQLString,
  })
  token: string = "";

  @gqlField({
    class: "UserAuthJWTPayload",
    type: GraphQLID,
  })
  viewerID: ID = "";
}

export class AuthResolver {
  @gqlMutation({
    class: "AuthResolver",
    name: "userAuth",
    type: "UserAuthPayload",
    async: true,
    args: [
      gqlContextType(),
      {
        name: "input",
        type: "UserAuthInput",
      },
    ],
  })
  async userAuth(
    context: RequestContext,
    input: UserAuthInput,
  ): Promise<UserAuthPayload> {
    const viewer = await useAndVerifyAuth(
      context,
      async () => {
        const data = await User.validateEmailPassword(
          input.emailAddress,
          input.password,
        );
        return data?.id;
      },
      User.loaderOptions(),
    );
    if (!viewer) {
      throw new Error("not the right credentials");
    }
    const user = await viewer?.viewer();
    if (!user) {
      throw new Error("not the right credentials");
    }

    return {
      viewerID: encodeGQLID(user),
    };
  }

  @gqlMutation({
    class: "AuthResolver",
    name: "userAuthJWT",
    type: "UserAuthJWTPayload",
    async: true,
    args: [
      gqlContextType(),
      {
        name: "input",
        type: "UserAuthJWTInput",
      },
    ],
  })
  async userAuthJWT(
    context: RequestContext,
    input: UserAuthJWTInput,
  ): Promise<UserAuthJWTPayload> {
    const [viewer, token] = await useAndVerifyAuthJWT(
      context,
      async () => {
        const data = await User.validateEmailPassword(
          input.emailAddress,
          input.password,
        );
        return data?.id;
      },
      {
        secretOrKey: "secret",
        signInOptions: {
          algorithm: "HS256",
          audience: "https://foo.com/website",
          issuer: "https://foo.com",
          expiresIn: "1h",
        },
      },
      User.loaderOptions(),
      // don't store this in session since we're using JWT here
      {
        session: false,
      },
    );
    if (!viewer) {
      throw new Error("not the right credentials");
    }
    const user = await viewer?.viewer();
    if (!user) {
      throw new Error("not the right credentials");
    }
    return {
      viewerID: encodeGQLID(user),
      token: token,
    };
  }
}
