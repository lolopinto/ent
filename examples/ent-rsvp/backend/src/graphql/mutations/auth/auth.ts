import { RequestContext, loadRow, query } from "@lolopinto/ent";
import {
  gqlContextType,
  gqlArg,
  gqlMutation,
  gqlInputObjectType,
  gqlField,
  gqlObjectType,
} from "@lolopinto/ent/graphql";
import { Guest } from "src/ent";
import { useAndVerifyAuthJWT } from "@lolopinto/ent-passport";
import { GQLViewer } from "../../resolvers/viewer";

@gqlInputObjectType()
class AuthGuestInput {
  @gqlField()
  emailAddress: string;
  @gqlField()
  code: string;
}

@gqlObjectType()
export class AuthGuestPayload {
  @gqlField()
  token: string;

  @gqlField({ type: GQLViewer })
  viewer: GQLViewer;
}

export class AuthGuestResolver {
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
          expiresIn: "24h",
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
      viewer: new GQLViewer(viewer),
      token: token,
    };
  }
}
