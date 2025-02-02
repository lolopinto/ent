/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLBoolean,
  GraphQLFieldConfigMap,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { Address } from "../../../ent";
import { UserPrefsStruct } from "../../../ent/generated/types";
import { AddressType, NotifTypeType } from "../../resolvers/internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

export const UserPrefsStructType = new GraphQLObjectType({
  name: "UserPrefsStruct",
  fields: (): GraphQLFieldConfigMap<
    UserPrefsStruct,
    RequestContext<ExampleViewerAlias>
  > => ({
    finishedNux: {
      type: GraphQLBoolean,
    },
    enableNotifs: {
      type: GraphQLBoolean,
    },
    notifTypes: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(NotifTypeType)),
      ),
    },
    homeAddress: {
      type: AddressType,
      resolve: (
        obj: UserPrefsStruct,
        args: {},
        context: RequestContext<ExampleViewerAlias>,
      ) => {
        if (obj.homeAddressId === null || obj.homeAddressId === undefined) {
          return null;
        }
        return Address.load(context.getViewer(), obj.homeAddressId);
      },
    },
    allAddresses: {
      type: new GraphQLList(new GraphQLNonNull(AddressType)),
      resolve: async (
        obj: UserPrefsStruct,
        args: {},
        context: RequestContext<ExampleViewerAlias>,
      ) => {
        if (obj.allAddressIds === null || obj.allAddressIds === undefined) {
          return null;
        }
        const objs = await Address.loadMany(
          context.getViewer(),
          ...obj.allAddressIds,
        );
        return Array.from(objs.values());
      },
    },
  }),
});
