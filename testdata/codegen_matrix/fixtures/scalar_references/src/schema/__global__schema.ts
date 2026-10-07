import { GlobalSchema, StructType, UUIDType } from "@snowtop/ent/schema";
const schema: GlobalSchema = {
  fields: {
    HolidayOverrideEntry: StructType({
      tsType: "HolidayOverrideEntry", graphQLType: "HolidayOverrideEntry",
      fields: { holiday_id: UUIDType() },
    }),
  },
};
export default schema;
