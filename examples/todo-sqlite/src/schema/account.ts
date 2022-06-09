import { EnumType } from "@snowtop/ent";
import { AllowIfViewerPrivacyPolicy } from "@snowtop/ent";
import { Action, ActionOperation, Field, StringType } from "@snowtop/ent";
import { PhoneNumberType } from "@snowtop/ent-phonenumber";
import { DeletedAtPattern } from "@snowtop/ent-soft-delete";
import BaseEntTodoSchema from "src/schema/patterns/base";

export default class Account extends BaseEntTodoSchema {
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
