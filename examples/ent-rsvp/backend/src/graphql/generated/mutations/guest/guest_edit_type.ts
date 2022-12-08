// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { RequestContext, Viewer } from "@snowtop/ent";
import { mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { Guest } from "src/ent/";
import EditGuestAction, {
  GuestEditInput,
} from "src/ent/guest/actions/edit_guest_action";
import { GuestType } from "src/graphql/resolvers/";

interface customGuestEditInput extends GuestEditInput {
  id: string;
}

interface GuestEditPayload {
  guest: Guest;
}

export const GuestEditInputType = new GraphQLInputObjectType({
  name: "GuestEditInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      description: "id of Guest",
      type: new GraphQLNonNull(GraphQLID),
    },
    name: {
      type: GraphQLString,
    },
    emailAddress: {
      type: GraphQLString,
    },
  }),
});

export const GuestEditPayloadType = new GraphQLObjectType({
  name: "GuestEditPayload",
  fields: (): GraphQLFieldConfigMap<
    GuestEditPayload,
    RequestContext<Viewer>
  > => ({
    guest: {
      type: new GraphQLNonNull(GuestType),
    },
  }),
});

export const GuestEditType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  { [input: string]: customGuestEditInput }
> = {
  type: new GraphQLNonNull(GuestEditPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(GuestEditInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<Viewer>,
    _info: GraphQLResolveInfo,
  ): Promise<GuestEditPayload> => {
    const guest = await EditGuestAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.id),
      {
        name: input.name,
        emailAddress: input.emailAddress,
      },
    );
    return { guest: guest };
  },
};
