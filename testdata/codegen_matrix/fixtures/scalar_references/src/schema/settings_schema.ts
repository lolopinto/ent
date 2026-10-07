import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { ActionOperation, EntSchema, StructType, StructTypeAsList, UUIDType, UUIDListType, UnionType, StringType } from "@snowtop/ent/schema";
export default new EntSchema({
  fields: {
    tree: StructType({globalType: "ReferenceTree", nullable: true}),
    trees: StructTypeAsList({globalType: "ReferenceTree", nullable: true}),
    mutualTree: StructType({globalType: "MutualTree", nullable: true}),
    rawNested: StructType({tsType: "RawOuter", nullable: true, fields: {
      inner: StructType({tsType: "RawInner", fields: {
        externalId: UUIDType(), externalIds: UUIDListType(), secretId: UUIDType(),
      }}),
    }}),
    savedReference: UUIDType({ graphQLIDType: "Holiday", nullable: true }),
    savedRawReference: UUIDType({ graphQLIDType: "Holiday", nullable: true, disableBase64Encode: true }),
    overrides: StructTypeAsList({ globalType: "HolidayOverrideEntry", nullable: true }),
    selection: StructType({
      tsType: "SelectedReference", nullable: true,
      fields: {
        choice: UnionType({
          tsType: "ReferenceChoice", nullable: true,
          fields: {
            holiday: StructType({tsType: "HolidayChoice", fields: {
              holidayId: UUIDType({graphQLIDType: "Holiday"}),
            }}),
            raw: StructType({tsType: "RawChoice", fields: {
              label: StringType(), rawId: UUIDType({disableBase64Encode: true}),
            }}),
          },
        }),
      },
    }),
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
