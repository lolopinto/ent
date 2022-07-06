import {
  StringType,
  ActionOperation,
  UUIDType,
  EntSchema,
} from "@snowtop/ent/schema";

const AddressSchema = new EntSchema({
  fields: {
    Street: StringType(),
    City: StringType(),
    State: StringType(),
    ZipCode: StringType(),
    Apartment: StringType({ nullable: true }),
    OwnerID: UUIDType({
      unique: true,
      polymorphic: true,
    }),
  },

  actions: [
    {
      operation: ActionOperation.Mutations,
    },
  ],
});
export default AddressSchema;
