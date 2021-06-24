import {
  Action,
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
} from "@snowtop/snowtop-ts";
import { PhoneNumberType } from "@snowtop/snowtop-phonenumber";

export default class Account extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "Name" }),
    PhoneNumberType({ name: "PhoneNumber", unique: true }),
  ];
  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
