import {
  gqlMutation,
  gqlContextType,
  encodeGQLID,
  gqlInputObjectType,
  gqlField,
  gqlObjectType,
} from "@snowtop/ent/graphql";
import { RequestContext, ID } from "@snowtop/ent";
import { useAndVerifyAuth, useAndVerifyAuthJWT } from "@snowtop/ent-passport";
import { User } from "../../ent";
import { GraphQLID, GraphQLString } from "graphql";

@gqlInputObjectType()
export class UserAuthInput {
  @gqlField({
    class: "UserAuthInput",
    type: GraphQLString,
    description: "email address of the user",
  })
  emailAddress: string;
  @gqlField({
    class: "UserAuthInput",
    type: GraphQLString,
    description: "password of the user",
  })
  password: string;

  constructor(emailAddress: string, password: string) {
    this.emailAddress = emailAddress;
    this.password = password;
  }
}

@gqlInputObjectType()
export class UserAuthJWTInput {
  @gqlField({
    class: "UserAuthJWTInput",
    type: GraphQLString,
  })
  emailAddress: string;
  @gqlField({
    class: "UserAuthJWTInput",
    type: GraphQLString,
  })
  password: string;

  constructor(emailAddress: string, password: string) {
    this.emailAddress = emailAddress;
    this.password = password;
  }
}

@gqlObjectType()
export class UserAuthPayload {
  @gqlField({
    class: "UserAuthPayload",
    type: GraphQLID,
  })
  viewerID: ID;

  constructor(viewerID: ID) {
    this.viewerID = viewerID;
  }
}

// TODO abstract classes..

@gqlObjectType()
export class UserAuthJWTPayload {
  @gqlField({
    class: "UserAuthJWTPayload",
    type: GraphQLString,
  })
  token: string;

  @gqlField({
    class: "UserAuthJWTPayload",
    type: GraphQLID,
  })
  viewerID: ID;

  constructor(viewerID: ID, token: string) {
    this.token = token;
    this.viewerID = viewerID;
  }
}

export class AuthResolver {
  @gqlMutation({
    class: "AuthResolver",
    name: "userAuth",
    type: "UserAuthPayload",
    async: true,
    description: "authenticate a user",
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

    return new UserAuthPayload(encodeGQLID(user));
  }

  @gqlMutation({
    class: "AuthResolver",
    name: "userAuthJWT",
    type: "UserAuthJWTPayload",
    description: "authenticate a user with JWT",
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

    return new UserAuthJWTPayload(encodeGQLID(user), token);
  }
}
