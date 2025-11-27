import { ActionOperation, EntSchema, IntegerType, StringType, UUIDType } from "{schema}";

// This schema demonstrates how create-time fields with defaults provided by
// the viewer or the server are treated as optional inputs when generating
// create actions.
const EventSchema = new EntSchema({
  fields: {
    // The viewer provides this automatically during creation.
    creatorId: UUIDType({ defaultToViewerOnCreate: true }),
    name: StringType(),
    // Server default values should not require explicit input.
    perHour: IntegerType({ serverDefault: "1" }),
    // Local default value on create also makes the field optional.
    hourlyLimit: IntegerType({ defaultValueOnCreate: () => 5 }),
  },
  actions: [
    {
      operation: ActionOperation.Create,
    },
  ],
});

export default EventSchema;
