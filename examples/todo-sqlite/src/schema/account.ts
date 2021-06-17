import {
  Action,
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
} from "@lolopinto/ent";
import { PhoneNumberType } from "@lolopinto/ent-phonenumber";

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
