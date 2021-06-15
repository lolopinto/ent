import {
  Action,
  ActionOperation,
  BaseEntSchema,
  BooleanType,
  Field,
  StringType,
  UUIDType,
} from "@lolopinto/ent";
import { PhoneNumberType } from "@lolopinto/ent-phonenumber";

export default class Todo extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "Text" }),
    BooleanType({
      name: "Completed",
      index: true,
      // serverDEFAULT is complicated on sqlite so use this
      // also this is generally more performant later
      defaultValueOnCreate: () => {
        return false;
      },
    }),
    UUIDType({
      name: "creatorID",
      foreignKey: { schema: "Account", column: "ID" },
    }),
  ];

  // actions: Action[] = [
  //   {
  //     operation: ActionOperation.Mutations,
  //   },
  // ];
}
