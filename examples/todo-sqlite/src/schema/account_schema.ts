import { EnumType } from "@snowtop/ent";
import { AllowIfViewerPrivacyPolicy } from "@snowtop/ent";
import { ActionOperation, StringType } from "@snowtop/ent";
import { PhoneNumberType } from "@snowtop/ent-phonenumber";
import { DeletedAtPattern } from "@snowtop/ent-soft-delete";
import { TodoEntSchema } from "src/schema/patterns/base";

const AccountSchema = new TodoEntSchema({
  patterns: [new DeletedAtPattern()],

  fields: {
    Name: StringType(),
    PhoneNumber: PhoneNumberType({
      unique: true,
      // only viewer can see their phone number
      privacyPolicy: AllowIfViewerPrivacyPolicy,
    }),
    accountState: EnumType({
      nullable: true,
      tsType: "AccountState",
      graphQLType: "AccountState",
      values: ["UNVERIFIED", "VERIFIED", "DEACTIVATED", "DISABLED"],
      defaultValueOnCreate: () => "UNVERIFIED",
      // only viewer can see their account state
      privacyPolicy: AllowIfViewerPrivacyPolicy,
    }),
  },

  actions: [
    {
      operation: ActionOperation.Mutations,
    },
  ],
});
export default AccountSchema;
