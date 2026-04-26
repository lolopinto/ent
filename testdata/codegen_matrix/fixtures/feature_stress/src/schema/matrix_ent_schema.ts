import {
  ActionOperation,
  BooleanType,
  EntSchema,
  IntegerType,
  StringType,
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
  },
  actions: [
    {
      operation: ActionOperation.Mutations,
    },
  ],
});

export default MatrixEntSchema;
