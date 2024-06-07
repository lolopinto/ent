import { AllowIfViewerIsEntPropertyRule, AlwaysDenyRule } from "@snowtop/ent";
import {
  ActionOperation,
  EntSchema,
  IntegerType,
  UUIDType,
} from "@snowtop/ent";

const UserStatisticsSchema = new EntSchema({
  fields: {
    userID: UUIDType({
      fieldEdge: { schema: "User", disableBuilderType: true },
      immutable: true,
      unique: true,
    }),
    authCodeEmailsSent: IntegerType({ serverDefault: 0 }),
  },

  actions: [
    {
      operation: ActionOperation.Mutations,
    },
  ],

  defaultActionPrivacy() {
    return {
      // @ts-ignore
      rules: [new AllowIfViewerIsEntPropertyRule("userId"), AlwaysDenyRule],
    };
  },
});

export default UserStatisticsSchema;
