import {
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLString,
  GraphQLNonNull,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLResolveInfo,
  GraphQLInputFieldConfigMap,
} from "graphql";
import { Context } from "ent/auth/context";
import { useAndAuth, LocalStrategy } from "ent/auth/passport";
import { Strategy as JWTStrategy, ExtractJwt } from "passport-jwt";
import User from "src/ent/user";
import { IDViewer } from "src/util/id_viewer";
import { ID } from "ent/ent";
import { IncomingMessage } from "http";
import jwt from "jsonwebtoken";

interface UserAuthJWTResponse {
  token: string;
  viewerID: ID;
}

interface UserAuthJWTInput {
  emailAddress: string;
  password: string;
}

export const UserAuthJWTInputType = new GraphQLInputObjectType({
  name: "UserAuthJWTInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    emailAddress: {
      type: GraphQLNonNull(GraphQLString),
    },
    password: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
});

export const UserAuthJWTResponseType = new GraphQLObjectType({
  name: "UserAuthJWTResponse",
  fields: (): GraphQLFieldConfigMap<UserAuthJWTResponse, Context> => ({
    token: {
      type: GraphQLNonNull(GraphQLString),
    },
    viewerID: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
});

class OmniViewer extends IDViewer {
  isOmniscient(): boolean {
    return true;
  }
}
export const UserAuthJWTType: GraphQLFieldConfig<
  undefined,
  Context,
  { [input: string]: UserAuthJWTInput }
> = {
  type: GraphQLNonNull(UserAuthJWTResponseType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(UserAuthJWTInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: Context,
    _info: GraphQLResolveInfo,
  ): Promise<UserAuthJWTResponse> => {
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
      { session: false },
    );

    if (!viewer?.viewerID) {
      throw new Error("not the right credentials");
    }

    const token = jwt.sign({ viewerID: viewer.viewerID }, "secret", {
      algorithm: "HS256",
      audience: "https://foo.com/website",
      issuer: "https://foo.com",
      subject: viewer.viewerID.toString(),
      expiresIn: "1h",
    });

    return {
      viewerID: viewer.viewerID.toString(),
      token: token,
    };
  },
};
