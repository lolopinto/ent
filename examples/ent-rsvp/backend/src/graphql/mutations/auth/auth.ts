import { RequestContext, loadRow, query } from "@snowtop/ent";
import { gqlContextType, gqlMutation, gqlQuery } from "@snowtop/ent/graphql";
import { useAndVerifyAuthJWT } from "@snowtop/ent-passport";
import { Guest, User } from "src/ent";
import { GraphQLViewer } from "../../resolvers/viewer_type";
import { GraphQLString } from "graphql";
import {
  AuthGuestInput,
  AuthGuestPayload,
  AuthUserInput,
  AuthUserPayload,
  AuthAnyInput,
  AuthAnyPayload,
} from "./auth_types";

export class AuthResolver {
  @gqlMutation({
    class: "AuthResolver",
    name: "authGuest",
    type: AuthGuestPayload,
    args: [
      gqlContextType(),
      {
        name: "input",
        type: AuthGuestInput,
      },
    ],
    async: true,
  })
  async authGuest(
    context: RequestContext,
    input: AuthGuestInput,
  ): Promise<AuthGuestPayload> {
    const [viewer, token] = await useAndVerifyAuthJWT(
      context,
      async () => {
        // TODO make this easier
        const row = await loadRow({
          tableName: "auth_codes",
          clause: query.And(
            query.Eq("email_address", input.emailAddress),
            query.Eq("code", input.code),
          ),
          fields: ["guest_id"],
        });
        return row?.guest_id;
      },
      {
        secretOrKey: "secret",
        signInOptions: {
          algorithm: "HS256",
          expiresIn: "30 days",
        },
      },
      Guest.loaderOptions(),
      {
        session: false,
      },
    );
    if (!viewer) {
      throw new Error(`could not log user in with given credentials`);
    }
    return new AuthGuestPayload(token, new GraphQLViewer(viewer));
  }

  @gqlQuery({
    class: "AuthResolver",
    name: "emailAvailable",
    type: Boolean,
    args: [
      {
        name: "email",
        type: GraphQLString,
      },
    ],
    async: true,
  })
  async emailAvailable(email: string) {
    const f = User.getField("EmailAddress");
    if (!f || !f.format) {
      throw new Error("could not find field EmailAddress for User");
    }
    const val = f.format(email);
    const id = await User.loadIdFromEmailAddress(val);
    return id === undefined;
  }

  @gqlMutation({
    class: "AuthResolver",
    name: "emailAvailable",
    type: Boolean,
    args: [
      {
        name: "email",
        type: GraphQLString,
      },
    ],
    async: true,
  })
  async emailAvailableMutation(email: string) {
    return this.emailAvailable(email);
  }

  @gqlMutation({
    class: "AuthResolver",
    name: "authUser",
    type: AuthUserPayload,
    args: [
      gqlContextType(),
      {
        name: "input",
        type: AuthUserInput,
      },
    ],
    async: true,
  })
  async authUser(
    context: RequestContext,
    input: AuthUserInput,
  ): Promise<AuthUserPayload> {
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
          expiresIn: "30 days",
        },
      },
      User.loaderOptions(),
      {
        session: false,
      },
    );
    if (!viewer) {
      throw new Error(`not the right credentials`);
    }

    return new AuthUserPayload(token, new GraphQLViewer(viewer));
  }

  @gqlMutation({
    class: "AuthResolver",
    name: "authAny",
    type: AuthAnyPayload,
    args: [
      gqlContextType(),
      {
        name: "input",
        type: AuthAnyInput,
      },
    ],
    async: true,
  })
  async authAny(
    context: RequestContext,
    input: AuthAnyInput,
  ): Promise<AuthAnyPayload> {
    if (input.user && input.guest) {
      throw new Error("cannot have both user and guest");
    }
    let userPayload: AuthUserPayload | null = null;
    let guestPayload: AuthGuestPayload | null = null;
    if (input.guest) {
      guestPayload = await this.authGuest(context, input.guest);
    }
    if (input.user) {
      userPayload = await this.authUser(context, input.user);
    }
    if (!userPayload && !guestPayload) {
      throw new Error("no valid credentials");
    }
    return new AuthAnyPayload(userPayload, guestPayload);
  }
}
