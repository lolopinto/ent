import {
  gqlInputObjectType,
  gqlField,
  gqlMutation,
  gqlContextType,
  gqlArg,
  gqlObjectType,
} from "ent/graphql";
import { Context } from "ent/auth/context";
import { useAndAuth, LocalStrategy } from "ent/auth/passport";
import User from "src/ent/user";
import { IDViewer } from "src/util/id_viewer";
import { ID } from "ent/ent";
import { GraphQLID } from "graphql";
import jwt from "jsonwebtoken";

@gqlInputObjectType()
// we're going to test exporting UserAuthInput types
// and not exporting JWT versions
export class UserAuthInput {
  @gqlField()
  emailAddress: string;
  @gqlField()
  password: string;
}

@gqlInputObjectType()
class UserAuthJWTInput {
  @gqlField()
  emailAddress: string;
  @gqlField()
  password: string;
}

@gqlObjectType()
export class UserAuthResponse {
  @gqlField()
  token: string;

  @gqlField({ type: GraphQLID })
  viewerID: ID;
}

// TODO abstract classes..

@gqlObjectType()
class UserAuthJWTResponse {
  @gqlField()
  token: string;

  @gqlField({ type: GraphQLID })
  viewerID: ID;
}

class OmniViewer extends IDViewer {
  isOmniscient(): boolean {
    return true;
  }
}

export class AuthResolver {
  @gqlMutation({ name: "userAuth", type: UserAuthResponse })
  async userAuth(
    @gqlContextType() context: Context,
    @gqlArg("input") input: UserAuthInput,
  ): Promise<UserAuthResponse> {
    const viewer = await useAndAuth(
      context,
      new LocalStrategy({
        verifyFn: async () => {
          // we need load raw here
          const user = await User.loadFromEmailAddress(
            // This leads to invalid uuid so we need to account for this
            //            new OmniViewer("1"),
            new OmniViewer("b38e3d04-4f6a-4421-a566-a211f4799c12"),
            input.emailAddress,
          );

          if (!user) {
            return null;
          }

          let valid = await user.verifyPassword(input.password);
          if (!valid) {
            return null;
          }
          return new IDViewer(user.id);
        },
      }),
    );

    if (!viewer || !viewer.viewerID) {
      throw new Error("not the right credentials");
    }

    return {
      viewerID: viewer.viewerID,
      token: "1",
    };
  }

  @gqlMutation({ name: "userAuthJWT", type: UserAuthJWTResponse })
  async userAuthJWT(
    @gqlContextType() context: Context,
    @gqlArg("input") input: UserAuthJWTInput,
  ): Promise<UserAuthJWTResponse> {
    // TODO: auth locally with username/password
    // get jwt, sign it return it
    // and then use jwt to get viewer
    // this is only done on login
    // everywhere else we need a jwt thing that's registered and checked for every request

    const viewer = await useAndAuth(
      context,
      new LocalStrategy({
        verifyFn: async () => {
          // we need load raw here
          const user = await User.loadFromEmailAddress(
            // This leads to invalid uuid so we need to account for this
            //            new OmniViewer("1"),
            new OmniViewer("b38e3d04-4f6a-4421-a566-a211f4799c12"),
            input.emailAddress,
          );

          if (!user) {
            return null;
          }

          let valid = await user.verifyPassword(input.password);
          if (!valid) {
            return null;
          }
          return new IDViewer(user.id);
        },
      }),
      // don't store this in session since we're using JWT here
      {
        session: false,
      },
    );

    if (!viewer?.viewerID) {
      throw new Error("not the right credentials");
    }

    const token = jwt.sign(
      {
        viewerID: viewer.viewerID,
      },
      "secret",
      {
        algorithm: "HS256",
        audience: "https://foo.com/website",
        issuer: "https://foo.com",
        subject: viewer.viewerID.toString(),
        expiresIn: "1h",
      },
    );

    return {
      viewerID: viewer.viewerID.toString(),
      token: token,
    };
  }
}
