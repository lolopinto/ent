import {
  gqlInputObjectType,
  gqlField,
  gqlMutation,
  gqlContextType,
  gqlArg,
  gqlObjectType,
  encodeGQLID,
} from "@snowtop/ent/graphql";
import { ID, RequestContext } from "@snowtop/ent";
import { GraphQLID } from "graphql";
import { useAndVerifyAuth, useAndVerifyAuthJWT } from "@snowtop/ent-passport";
import { User } from "../../ent";

@gqlInputObjectType()
// we're going to test exporting UserAuthInput types
// and not exporting JWT versions
export class UserAuthInput {
  @gqlField()
  emailAddress: string = "";
  @gqlField()
  password: string = "";
}

@gqlInputObjectType()
class UserAuthJWTInput {
  @gqlField()
  emailAddress: string = "";
  @gqlField()
  password: string = "";
}

@gqlObjectType()
export class UserAuthPayload {
  @gqlField({ type: GraphQLID })
  viewerID: ID = "";
}

// TODO abstract classes..

@gqlObjectType()
class UserAuthJWTPayload {
  @gqlField()
  token: string = "";

  @gqlField({ type: GraphQLID })
  viewerID: ID = "";
}

export class AuthResolver {
  @gqlMutation({ name: "userAuth", type: UserAuthPayload })
  async userAuth(
    @gqlContextType() context: RequestContext,
    @gqlArg("input") input: UserAuthInput,
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

  @gqlMutation({ name: "userAuthJWT", type: UserAuthJWTPayload })
  async userAuthJWT(
    @gqlContextType() context: RequestContext,
    @gqlArg("input") input: UserAuthJWTInput,
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
