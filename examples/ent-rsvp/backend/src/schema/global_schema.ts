import { EnumType, GlobalSchema } from "@snowtop/ent/schema/";

const glo: GlobalSchema = {
  fields: {
    tag: EnumType({
      // contrived enum to show enums in GuestSchema with disableUnknownType: true
      // and used in other schemas
      tsType: "GuestTag",
      graphQLType: "GuestTag",
      values: ["friend", "coworker", "family"],
      disableUnknownType: true,
    }),
  },
};
export default glo;
