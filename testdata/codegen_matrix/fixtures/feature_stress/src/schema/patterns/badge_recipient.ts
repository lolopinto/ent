import {
  BooleanType,
  DateType,
  EnumType,
  IntegerEnumType,
  IntegerType,
  Pattern,
  StringType,
  StructType,
  StructTypeAsList,
  UUIDType,
} from "@snowtop/ent/schema";
import {
  AlwaysAllowPrivacyPolicy,
  AlwaysDenyPrivacyPolicy,
  query,
} from "@snowtop/ent";

enum MatrixVisibility {
  VISIBLE = 0,
  DELETED = 1,
  DEACTIVATED = 2,
}

export const BadgeRecipient: Pattern = {
  name: "BadgeRecipient",
  fields: {
    badgeProgress: StructType({
      tsType: "BadgeProgress",
      graphQLType: "BadgeProgress",
      nullable: true,
      privacyPolicy: AlwaysAllowPrivacyPolicy,
      fields: {
        competitionsWon: IntegerType({
          nullable: true,
        }),
      },
    }),
    badges: StructTypeAsList({
      tsType: "Badge",
      graphQLType: "Badge",
      nullable: true,
      privacyPolicy: AlwaysDenyPrivacyPolicy,
      fields: {
        typeOfBadge: EnumType({
          tsType: "TypeOfBadge",
          graphQLType: "TypeOfBadge",
          values: ["GOLD", "SILVER"],
        }),
        awardedOn: DateType({
          immutable: true,
        }),
        referenceEntID: UUIDType({
          polymorphic: {
            types: ["CompetitionEvent"],
          },
          immutable: true,
        }),
        currency: EnumType({
          tsType: "Currency",
          graphQLType: "Currency",
          values: ["USD", "EUR"],
          nullable: true,
        }),
        level: EnumType({
          tsType: "BadgeLevel",
          graphQLType: "BadgeLevel",
          values: ["LOCAL", "GLOBAL"],
        }),
        publicNote: StringType({
          nullable: true,
        }),
        hidden: BooleanType({
          nullable: true,
        }),
      },
    }),
    status: IntegerEnumType({
      map: {
        VISIBLE: MatrixVisibility.VISIBLE,
        DELETED: MatrixVisibility.DELETED,
        DEACTIVATED: MatrixVisibility.DEACTIVATED,
      },
      tsType: "MatrixVisibility",
      defaultValueOnCreate: () => MatrixVisibility.VISIBLE,
      disableUserGraphQLEditable: true,
      hideFromGraphQL: true,
      disableUnknownType: true,
    }),
  },
  edges: [
    {
      name: "badgeRecipients",
      schemaName: "User",
      inverseEdge: {
        name: "badgeSources",
        hideFromGraphQL: true,
      },
    },
  ],
  transformRead() {
    return query.Eq("status", MatrixVisibility.VISIBLE);
  },
  transformReadCodegen_BETA() {
    return {
      code: "query.Eq('status', MatrixVisibility.VISIBLE)",
      imports: [
        {
          importPath: "@snowtop/ent",
          import: "query",
        },
        {
          importPath: "src/ent/generated/types",
          import: "MatrixVisibility",
        },
      ],
    };
  },
};
