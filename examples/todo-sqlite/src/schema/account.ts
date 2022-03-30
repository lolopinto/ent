import { EnumType } from "@snowtop/ent";
import {
  Action,
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
} from "@snowtop/ent";
import { PhoneNumberType } from "@snowtop/ent-phonenumber";

export default class Account extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "Name" }),
    PhoneNumberType({ name: "PhoneNumber", unique: true }),
    EnumType({
      nullable: true,
      name: "accountState",
      tsType: "AccountState",
      graphQLType: "AccountState",
      values: ["UNVERIFIED", "VERIFIED", "DEACTIVATED", "DISABLED"],
      defaultValueOnCreate: () => "UNVERIFIED",
    }),
  ];
  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
