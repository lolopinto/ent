import {
  ActionOperation,
  BooleanType,
  EntSchema,
  IntegerType,
  StringType,
  StructType,
} from "@snowtop/ent/schema";
import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";

const MatrixEntSchema = new EntSchema({
  tableName: "matrix_ents",
  fields: {
    name: StringType({
      unique: true,
      graphqlName: "displayName",
      privacyPolicy: AlwaysAllowPrivacyPolicy,
    }),
    active: BooleanType({
      serverDefault: true,
      defaultValueOnCreate: () => true,
    }),
    rank: IntegerType({
      nullable: true,
      index: true,
    }),
    preferences: StructType({
      globalType: "MatrixPreferences",
      serverDefault: {
        notificationsEnabled: true,
        locale: "en_US",
      },
    }),
  },
  actions: [
    {
      operation: ActionOperation.Mutations,
    },
  ],
});

export default MatrixEntSchema;
