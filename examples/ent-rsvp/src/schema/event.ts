import {
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
  UUIDType,
  Action,
} from "@lolopinto/ent";

export default class Event extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "Name" }),
    UUIDType({ name: "creatorID", foreignKey: ["User", "ID"] }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
