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
  ];
  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
