import { EnumType } from "@snowtop/ent";
import { AllowIfViewerPrivacyPolicy } from "@snowtop/ent";
import {
  Action,
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
} from "@snowtop/ent";
import { PhoneNumberType } from "@snowtop/ent-phonenumber";
import { DeletedAtPattern } from "@snowtop/ent-soft-delete";

export default class Account extends BaseEntSchema {
  constructor() {
    super();
    this.addPatterns(new DeletedAtPattern());
  }

  fields: Field[] = [
    StringType({ name: "Name" }),
    PhoneNumberType({
      name: "PhoneNumber",
      unique: true,
      // only viewer can see their phone number
      // TODO: builder type needs to not change. needs to be non-nullable if original field wasn't nullable
      privacyPolicy: AllowIfViewerPrivacyPolicy,
    }),
    EnumType({
      nullable: true,
      name: "accountState",
      tsType: "AccountState",
      graphQLType: "AccountState",
      values: ["UNVERIFIED", "VERIFIED", "DEACTIVATED", "DISABLED"],
      defaultValueOnCreate: () => "UNVERIFIED",
      // only viewer can see their account state
      privacyPolicy: AllowIfViewerPrivacyPolicy,
    }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
