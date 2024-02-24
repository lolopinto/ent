import {
  ActionOperation,
  StringType,
  UUIDType,
  ConstraintType,
  EntSchema,
  EnumType,
} from "@snowtop/ent";
import { EmailType } from "@snowtop/ent-email";
import { WithAddressPattern } from "./patterns/with_address_pattern";

const GuestSchema = new EntSchema({
  patterns: [new WithAddressPattern()],

  fields: {
    Name: StringType(),
    eventID: UUIDType({
      foreignKey: { schema: "Event", column: "id" },
    }),
    EmailAddress: EmailType({ nullable: true }),
    guestGroupID: UUIDType({
      foreignKey: { schema: "GuestGroup", column: "id" },
    }),
    title: StringType({ nullable: true }),
    // contrived example of a field edge of a node hidden from graphql
    // even though this is never set based on how rsvps work (it's stored in the data field of the rsvp edge)
    // we're just showing what happens when we have a fieldEdge for a node hidden from GraphQL
    // https://github.com/lolopinto/ent/issues/1565
    // field is still exposed to graphql since it's not hidden
    guest_data_id: UUIDType({
      nullable: true,
      fieldEdge: {
        schema: "GuestData",
      },
    }),
    tag: EnumType({
      globalType: "GuestTag",
      nullable: true,
    }),
  },

  actions: [
    {
      operation: ActionOperation.Create,
    },
    {
      operation: ActionOperation.Delete,
    },
    {
      operation: ActionOperation.Edit,
      fields: ["Name", "EmailAddress"],
    },
  ],

  constraints: [
    {
      name: "uniqueEmail",
      type: ConstraintType.Unique,
      columns: ["eventID", "EmailAddress"],
    },
  ],
});
export default GuestSchema;
