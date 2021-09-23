import { RequestContext, loadRow, query, LoggedOutViewer } from "@snowtop/ent";
import {
  gqlContextType,
  gqlArg,
  gqlMutation,
  gqlInputObjectType,
  gqlField,
  gqlObjectType,
  gqlQuery,
} from "@snowtop/ent/graphql";
import { useAndVerifyAuthJWT } from "@snowtop/ent-passport";
import { Guest, User } from "src/ent";
import { ViewerType } from "../../resolvers/viewer";

@gqlInputObjectType()
class AuthGuestInput {
  @gqlField()
  emailAddress: string = "";
  @gqlField()
  code: string = "";
}

@gqlObjectType()
export class AuthGuestPayload {
  @gqlField()
  token: string = "";

  @gqlField({ type: ViewerType })
  viewer: ViewerType = new ViewerType(new LoggedOutViewer());
}

@gqlInputObjectType()
class AuthUserInput {
  @gqlField()
  emailAddress: string = "";
  @gqlField()
  password: string = "";
}

@gqlObjectType()
export class AuthUserPayload {
  @gqlField()
  token: string = "";

  @gqlField({ type: ViewerType })
  viewer: ViewerType = new ViewerType(new LoggedOutViewer());
}

export class AuthResolver {
  @gqlMutation({ name: "authGuest", type: AuthGuestPayload })
  async authGuest(
    @gqlContextType() context: RequestContext,
    @gqlArg("input") input: AuthGuestInput,
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
    return {
      viewer: new ViewerType(viewer),
      token: token,
    };
  }

  @gqlQuery({ name: "emailAvailable", type: Boolean })
  async emailAvailable(@gqlArg("email") email: string) {
    const f = User.getField("EmailAddress");
    if (!f || !f.format) {
      throw new Error("could not find field EmailAddress for User");
    }
    const val = f.format(email);
    const id = await User.loadIDFromEmailAddress(val);
    return id === undefined;
  }

  @gqlMutation({ name: "emailAvailable", type: Boolean })
  async emailAvailableMutation(@gqlArg("email") email: string) {
    return this.emailAvailable(email);
  }

  @gqlMutation({ name: "authUser", type: AuthUserPayload })
  async authUser(
    @gqlContextType() context: RequestContext,
    @gqlArg("input") input: AuthUserInput,
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
    return {
      viewer: new ViewerType(viewer),
      token,
    };
  }
}
