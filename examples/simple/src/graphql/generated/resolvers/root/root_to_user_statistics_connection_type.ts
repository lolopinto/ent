/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { GraphQLObjectType } from "graphql";
import { Data } from "@snowtop/ent";
import { GraphQLConnectionType } from "@snowtop/ent/graphql";
import { UserStatisticsType } from "../../../resolvers/internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

var connType: GraphQLConnectionType<
  GraphQLObjectType,
  Data,
  ExampleViewerAlias
>;

export const RootToUserStatisticsConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType(
      "RootToUserStatistics",
      UserStatisticsType,
    );
  }
  return connType;
};