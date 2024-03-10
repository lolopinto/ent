import { LoggedOutViewer } from "@snowtop/ent";
import {
  gqlInputObjectType,
  gqlField,
  gqlObjectType,
} from "@snowtop/ent/graphql";
import { GraphQLViewer } from "../../resolvers/viewer_type";
import { GraphQLString } from "graphql";

@gqlInputObjectType()
export class AuthGuestInput {
  @gqlField({
    class: "AuthGuestInput",
    type: GraphQLString,
    nullable: false,
  })
  emailAddress: string = "";

  @gqlField({ class: "AuthGuestInput", type: GraphQLString })
  code: string = "";
}

@gqlObjectType()
export class AuthGuestPayload {
  @gqlField({
    class: "AuthGuestPayload",
    type: GraphQLString,
  })
  token: string;

  @gqlField({
    class: "AuthGuestPayload",
    type: GraphQLViewer,
  })
  viewer: GraphQLViewer = new GraphQLViewer(new LoggedOutViewer());

  constructor(token: string, viewer: GraphQLViewer) {
    this.token = token;
    this.viewer = viewer;
  }
}

@gqlInputObjectType()
export class AuthUserInput {
  @gqlField({
    class: "AuthUserInput",
    type: GraphQLString,
  })
  emailAddress: string = "";

  @gqlField({
    class: "AuthUserInput",
    type: GraphQLString,
  })
  password: string = "";
}

@gqlInputObjectType()
export class AuthAnyInput {
  @gqlField({
    class: "AuthAnyInput",
    type: AuthUserInput,
    nullable: true,
  })
  user: AuthUserInput | null = null;

  @gqlField({
    class: "AuthAnyInput",
    type: AuthGuestInput,
    nullable: true,
  })
  guest: AuthGuestInput | null = null;

  constructor(user: AuthUserInput | null, guest: AuthGuestInput | null) {
    this.user = user;
    this.guest = guest;
  }
}

@gqlObjectType()
export class AuthUserPayload {
  @gqlField({
    class: "AuthUserPayload",
    type: GraphQLString,
  })
  token: string = "";

  @gqlField({
    class: "AuthUserPayload",
    type: GraphQLViewer,
  })
  viewer: GraphQLViewer = new GraphQLViewer(new LoggedOutViewer());

  constructor(token: string, viewer: GraphQLViewer) {
    this.token = token;
    this.viewer = viewer;
  }
}

@gqlObjectType()
export class AuthAnyPayload {
  @gqlField({
    class: "AuthAnyPayload",
    type: AuthUserPayload,
    nullable: true,
  })
  user: AuthUserPayload | null = null;

  @gqlField({
    class: "AuthAnyPayload",
    type: AuthGuestPayload,
    nullable: true,
  })
  guest: AuthGuestPayload | null = null;

  constructor(user: AuthUserPayload | null, guest: AuthGuestPayload | null) {
    this.user = user;
    this.guest = guest;
  }
}
