import { GlobalSchema, StructType, StructTypeAsList, UUIDType } from "@snowtop/ent/schema";
const schema: GlobalSchema = {
  fields: {
    ReferenceTree: StructType({tsType: "ReferenceTree", fields: {
      holidayId: UUIDType({graphQLIDType: "Holiday"}),
      children: StructTypeAsList({globalType: "ReferenceTree", nullable: true}),
    }}),
    MutualTree: StructType({tsType: "MutualTree", fields: {
      holidayId: UUIDType({graphQLIDType: "Holiday"}),
      next: StructType({globalType: "MutualBranch", nullable: true}),
    }}),
    MutualBranch: StructType({tsType: "MutualBranch", fields: {
      holidayId: UUIDType({graphQLIDType: "Holiday"}),
      children: StructTypeAsList({globalType: "MutualTree", nullable: true}),
    }}),
    HolidayOverrideEntry: StructType({
      tsType: "HolidayOverrideEntry", graphQLType: "HolidayOverrideEntry",
      fields: { holiday_id: UUIDType() },
    }),
  },
};
export default schema;
