import {
  ActionOperation,
  EntSchema,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema";
import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";

const UserSchema = new EntSchema({
  fields: {
    name: StringType({
      privacyPolicy: AlwaysAllowPrivacyPolicy,
      editPrivacyPolicy: AlwaysAllowPrivacyPolicy,
    }),
    primaryPaymentID: UUIDType({
      nullable: true,
      foreignKey: {
        schema: "Payment",
        column: "id",
        name: "user_primary_payment",
        disableIndex: true,
        ondelete: "RESTRICT",
      },
    }),
  },
  actions: [
    {
      operation: ActionOperation.Mutations,
    },
  ],
});

export default UserSchema;
