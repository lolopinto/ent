import {
  BooleanType,
  EnumType,
  Pattern,
  StructType,
  UUIDType,
} from "@snowtop/ent";
import { getLoaderInfoFromSchema } from "../../ent/generated/loaders";

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
    contactID: UUIDType({
      immutable: true,
      fieldEdge: {
        schema: "Contact",
        enforceSchema: true,
        getLoaderInfoFromSchema: getLoaderInfoFromSchema,
      },
    }),
    // added to test foreign keys in patterns.
    // normally won't have this since contact has it
    ownerID: UUIDType({
      immutable: true,
      foreignKey: { schema: "User", column: "id" },
    }),
  };
}
