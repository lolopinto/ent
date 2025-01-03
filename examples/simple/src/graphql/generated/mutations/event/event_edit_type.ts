/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { GraphQLByte } from "graphql-scalars";
import { RequestContext } from "@snowtop/ent";
import {
  GraphQLTime,
  mustDecodeIDFromGQLID,
  mustDecodeNullableIDFromGQLID,
} from "@snowtop/ent/graphql";
import { Event } from "../../../../ent";
import EditEventAction, {
  EventEditInput,
} from "../../../../ent/event/actions/edit_event_action";
import { AttachmentInputType } from "../input/attachment_input_type";
import { EventType } from "../../../resolvers";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

interface customEventEditInput extends Omit<EventEditInput, "location"> {
  id: string;
  eventLocation?: string;
  addressId?: string;
}

interface EventEditPayload {
  event: Event;
}

export const EventEditInputType = new GraphQLInputObjectType({
  name: "EventEditInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      description: "id of Event",
      type: new GraphQLNonNull(GraphQLID),
    },
    name: {
      type: GraphQLString,
    },
    startTime: {
      type: GraphQLTime,
    },
    endTime: {
      type: GraphQLTime,
    },
    eventLocation: {
      type: GraphQLString,
    },
    addressId: {
      type: GraphQLID,
    },
    coverPhoto: {
      type: GraphQLByte,
    },
    coverPhoto2: {
      type: GraphQLByte,
    },
    attachments: {
      type: new GraphQLList(new GraphQLNonNull(AttachmentInputType)),
    },
  }),
});

export const EventEditPayloadType = new GraphQLObjectType({
  name: "EventEditPayload",
  fields: (): GraphQLFieldConfigMap<
    EventEditPayload,
    RequestContext<ExampleViewerAlias>
  > => ({
    event: {
      type: new GraphQLNonNull(EventType),
    },
  }),
});

export const EventEditType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  { [input: string]: customEventEditInput }
> = {
  type: new GraphQLNonNull(EventEditPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(EventEditInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<ExampleViewerAlias>,
    _info: GraphQLResolveInfo,
  ): Promise<EventEditPayload> => {
    const event = await EditEventAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.id),
      {
        name: input.name,
        startTime: input.startTime,
        endTime: input.endTime,
        location: input.eventLocation,
        addressId: mustDecodeNullableIDFromGQLID(
          input.addressId?.toString() ?? input.addressId,
        ),
        coverPhoto: input.coverPhoto,
        coverPhoto2: input.coverPhoto2,
        attachments: input.attachments?.map((item: any) => ({
          ...item,
          fileId: mustDecodeIDFromGQLID(item.fileId.toString()),
          dupeFileId: item.dupeFileId
            ? mustDecodeNullableIDFromGQLID(
                item.dupeFileId?.toString() ?? item.dupeFileId,
              )
            : undefined,
          creatorId: item.creatorId
            ? mustDecodeNullableIDFromGQLID(
                item.creatorId?.toString() ?? item.creatorId,
              )
            : undefined,
        })),
      },
    );
    return { event };
  },
};
