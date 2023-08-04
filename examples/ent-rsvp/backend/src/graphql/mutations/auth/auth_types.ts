import { LoggedOutViewer } from "@snowtop/ent";
import {
  gqlInputObjectType,
  gqlField,
  gqlObjectType,
} from "@snowtop/ent/graphql";
import { ViewerType } from "../../resolvers/viewer_type";
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
    type: ViewerType,
  })
  viewer: ViewerType = new ViewerType(new LoggedOutViewer());

  constructor(token: string, viewer: ViewerType) {
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

@gqlObjectType()
export class AuthUserPayload {
  @gqlField({
    class: "AuthUserPayload",
    type: GraphQLString,
  })
  token: string = "";

  @gqlField({
    class: "AuthUserPayload",
    type: ViewerType,
  })
  viewer: ViewerType = new ViewerType(new LoggedOutViewer());

  constructor(token: string, viewer: ViewerType) {
    this.token = token;
    this.viewer = viewer;
  }
}
