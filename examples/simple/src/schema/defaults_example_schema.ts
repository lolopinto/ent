import {
  ActionOperation,
  EntSchema,
  IntegerType,
  StringType,
  StructTypeAsList,
  UUIDType,
} from "@snowtop/ent/schema/";

// This schema demonstrates how create-time fields with defaults provided by
// the viewer or the server are treated as optional inputs when generating
// create actions.
const DefaultsExampleSchema = new EntSchema({
  fields: {
    // The viewer provides this automatically during creation.
    creatorId: UUIDType({ defaultToViewerOnCreate: true }),
    name: StringType(),
    // Server default values should not require explicit input.
    perHour: IntegerType({ serverDefault: "1" }),
    // Local default value on create also makes the field optional.
    hourlyLimit: IntegerType({ defaultValueOnCreate: () => 5 }),
    payloads: StructTypeAsList({
      tsType: "DefaultsPayload",
      fields: {
        data: StringType({ nullable: true }),
        first_name: StringType({ nullable: true }),
        last_name: StringType({ nullable: true }),
      },
      defaultValueOnCreate: () => [],
    }),
  },
  actions: [
    {
      operation: ActionOperation.Create,
    },
  ],
});

export default DefaultsExampleSchema;
