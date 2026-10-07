import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { ActionOperation, EntSchema, StructType, StructTypeAsList, UUIDType, UUIDListType } from "@snowtop/ent/schema";
export default new EntSchema({
  fields: {
    savedReference: UUIDType({ graphQLIDType: "Holiday", nullable: true }),
    savedRawReference: UUIDType({ graphQLIDType: "Holiday", nullable: true, disableBase64Encode: true }),
    overrides: StructTypeAsList({ globalType: "HolidayOverrideEntry", nullable: true }),
    nested: StructType({
      tsType: "NestedSettings", nullable: true,
      fields: {
        entries: StructTypeAsList({ globalType: "HolidayOverrideEntry", nullable: true }),
        reference: UUIDType({ graphQLIDType: "Holiday", nullable: true }),
        references: UUIDListType({ graphQLIDType: "Holiday", nullable: true }),
        raw: UUIDType({ graphQLIDType: "Holiday", disableBase64Encode: true, nullable: true }),
      },
    }),
  },
  defaultActionPrivacy: AlwaysAllowPrivacyPolicy,
  actions: [{ operation: ActionOperation.Mutations }],
});
