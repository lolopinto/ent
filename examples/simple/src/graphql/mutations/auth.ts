import {
  gqlMutation,
  gqlContextType,
  encodeGQLID,
  gqlInputObjectType,
  gqlField,
} from "@snowtop/ent/graphql";
import { RequestContext } from "@snowtop/ent";
import { useAndVerifyAuth, useAndVerifyAuthJWT } from "@snowtop/ent-passport";
import { User } from "../../ent";
import {
  UserAuthInput,
  UserAuthJWTInput,
  UserAuthJWTPayload,
  UserAuthPayload,
} from "./auth_types";
import { GraphQLString } from "graphql";

@gqlInputObjectType({
  name: "PhoneAvailableArg",
})
export class PhoneAvailableInput {
  @gqlField({
    class: "PhoneAvailableInput",
    type: GraphQLString,
  })
  phoneNumber: string;

  constructor(phone: string) {
    this.phoneNumber = phone;
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

  @gqlMutation({
    class: "AuthResolver",
    name: "phoneAvailable",
    type: Boolean,
    args: [
      {
        name: "input",
        type: "PhoneAvailableInput",
      },
    ],
    async: true,
  })
  async phoneAvailable(input: PhoneAvailableInput) {
    const f = User.getField("PhoneNumber");
    if (!f || !f.format) {
      throw new Error("could not find field PhoneNumber for User");
    }
    const val = f.format(input.phoneNumber);
    const id = await User.loadIdFromPhoneNumber(val);
    return id === undefined;
  }
}
