/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { GraphQLObjectType } from "graphql";
import { Data } from "@snowtop/ent";
import { GraphQLConnectionType } from "@snowtop/ent/graphql";
import { ContactEmailType } from "../../../resolvers/internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

var connType: GraphQLConnectionType<
  GraphQLObjectType,
  Data,
  ExampleViewerAlias
>;

export const ContactToFilterContactEmailsConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType(
      "ContactToFilterContactEmails",
      ContactEmailType,
    );
  }
  return connType;
};
