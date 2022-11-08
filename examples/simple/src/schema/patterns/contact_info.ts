import { BooleanType, EnumType, Pattern, StructType } from "@snowtop/ent";

// contrived pattern here with struct types to be shared with email and phone

export default class ContactInfo implements Pattern {
  name = "contact_info";
  fields = {
    extra: StructType({
      tsType: "ContactInfo",
      graphQLType: "ContactInfo",
      nullable: true,
      fields: {
        // e.g. default email or phone number
        default: BooleanType(),
        source: EnumType({
          tsType: "ContactInfoSource",
          graphQLType: "ContactInfoSource",
          values: ["friend", "work", "online"],
        }),
      },
    }),
  };
}
