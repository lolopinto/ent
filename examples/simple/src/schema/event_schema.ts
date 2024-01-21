import {
  AllowIfViewerInboundEdgeExistsRule,
  AllowIfViewerIsEntPropertyRule,
  AllowIfViewerIsRule,
  AlwaysDenyRule,
} from "@snowtop/ent";
import {
  EntSchema,
  ActionOperation,
  StringType,
  TimestampType,
  UUIDType,
  ByteaType,
  BinaryTextType,
  StructTypeAsList,
} from "@snowtop/ent/schema/";
import { EdgeType } from "../ent/generated/types";

/// explicit schema
const EventSchema = new EntSchema({
  showCanViewerSee: true,

  // pre-fields comment. intentionally doesn't parse decorators since we don't need it
  fields: {
    name: StringType(),
    // we should warn when we see an "ID/id/Id" field as non-id type and ask if they wanna change it
    // name comment
    creatorID: UUIDType({
      immutable: true,
      index: true,
      fieldEdge: {
        schema: "User",
        inverseEdge: "createdEvents",
        // even more nested comment...
        disableBuilderType: true,
        // this should create a CreatorToEventsQuery and connection instead of the default
        // UserToEventsQuery and connection
        edgeConstName: "CreatorToEvents",
        indexEdge: {
          // create edge eventsCreated (ent) and events_created graphql
          // which point to CreatorToEventsQuery
          name: "events_created",
        },
      },
      // storage_key chosen blah blah blah
      storageKey: "user_id",
    }),
    start_time: TimestampType(),
    end_time: TimestampType({ nullable: true }),
    location: StringType({
      graphqlName: "eventLocation",
    }),
    addressID: UUIDType({
      nullable: true,
      fieldEdge: { schema: "Address", inverseEdge: "hostedEvents" },
      privacyPolicy: {
        // only creator or attendees can see event address
        rules: [
          new AllowIfViewerInboundEdgeExistsRule(
            EdgeType.UserToEventsAttending,
          ),
          new AllowIfViewerIsRule("creatorID"),
          AlwaysDenyRule,
        ],
      },
    }),
    cover_photo: ByteaType({ nullable: true }),
    cover_photo2: BinaryTextType({ nullable: true }),
    attachments: StructTypeAsList({
      nullable: true,
      globalType: "Attachment",
    }),
  },

  defaultActionPrivacy: {
    rules: [
      // @ts-ignore
      new AllowIfViewerIsEntPropertyRule("creatorID"),
      AlwaysDenyRule,
    ],
  },

  edges: [
    {
      name: "hosts",
      schemaName: "User",
      inverseEdge: {
        name: "userToHostedEvents",
      },
      edgeActions: [
        {
          operation: ActionOperation.AddEdge,
        },
        {
          operation: ActionOperation.RemoveEdge,
        },
      ],
    },
  ],

  edgeGroups: [
    {
      name: "rsvps",
      groupStatusName: "rsvpStatus",
      viewerBased: true,
      nullStates: ["canRsvp"],
      statusEnums: ["attending", "declined", "maybe"],
      edgeAction: {
        operation: ActionOperation.EdgeGroup,
      },
      assocEdges: [
        {
          name: "invited",
          schemaName: "User",
          inverseEdge: {
            name: "invitedEvents",
          },
        },
        {
          // yes
          name: "attending",
          schemaName: "User",
          inverseEdge: {
            name: "eventsAttending",
          },
        },
        {
          // no
          name: "declined",
          schemaName: "User",
          inverseEdge: {
            name: "declinedEvents",
          },
        },
        {
          // maybe
          name: "maybe",
          schemaName: "User",
          inverseEdge: {
            name: "maybeEvents",
          },
        },
      ],
    },
  ],

  // create, edit, delete
  actions: [
    {
      operation: ActionOperation.Mutations,
    },
    {
      operation: ActionOperation.Edit,
      actionName: "ClearEventRsvpStatusAction",
      inputName: "ClearEventRsvpStatusInput",
      graphQLName: "eventRsvpStatusClear",
      noFields: true,
      actionOnlyFields: [
        {
          name: "userID",
          type: "ID",
        },
        {
          name: "whatever",
          type: "Boolean",
          nullable: true,
          hideFromGraphQL: true,
        },
      ],
    },
  ],

  indices: [
    {
      name: "event_time_indices",
      columns: ["start_time", "end_time"],
    },
  ],
});
export default EventSchema;
