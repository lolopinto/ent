import {
  ID,
  IDViewer,
  loadEntFromClause,
  loadRows,
  RequestContext,
  loadRow,
  query,
} from "@lolopinto/ent";
import {
  gqlContextType,
  gqlArg,
  gqlMutation,
  gqlInputObjectType,
  gqlField,
  gqlObjectType,
} from "@lolopinto/ent/graphql";
import { Guest } from "src/ent";
import { LocalStrategy, useAndAuth } from "@lolopinto/ent/auth";
import jwt from "jsonwebtoken";
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
    const viewer = await useAndAuth(
      context,
      new LocalStrategy({
        verifyFn: async () => {
          // TODO make this easier
          const row = await loadRow({
            tableName: "auth_codes",
            clause: query.And(
              query.Eq("email_address", input.emailAddress),
              query.Eq("code", input.code),
            ),
            fields: ["id", "guest_id"],
          });
          if (!row) {
            return null;
          }
          const guest = await Guest.loadX(
            new IDViewer(row.guest_id, { context }),
            row.guest_id,
          );
          return guest.viewer;
        },
      }),
      {
        session: false,
      },
    );
    if (!viewer || !viewer.viewerID) {
      throw new Error(`could not log user in with given credentials`);
    }

    const token = jwt.sign(
      {
        viewerID: viewer.viewerID,
      },
      "secret",
      {
        algorithm: "HS256",
        subject: viewer.viewerID.toString(),
        expiresIn: "24h",
      },
    );

    return {
      viewer: new GQLViewer(viewer),
      token: token,
    };
  }
}
