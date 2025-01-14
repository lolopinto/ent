import {
  gqlInputObjectType,
  gqlField,
  gqlObjectType,
} from "@snowtop/ent/graphql";
import { ID } from "@snowtop/ent";
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

@gqlObjectType()
export class UserAuthJWTLogin {
  @gqlField({
    class: "UserAuthJWTLogin",
    type: GraphQLString,
  })
  token: string;

  @gqlField({
    class: "UserAuthJWTLogin",
    type: GraphQLID,
  })
  viewerID: ID;

  constructor(viewerID: ID, token: string) {
    this.token = token;
    this.viewerID = viewerID;
  }
}
