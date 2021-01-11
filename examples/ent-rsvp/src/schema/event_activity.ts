import {
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
  UUIDType,
  Action,
  TimeType,
} from "@lolopinto/ent";

export default class EventActivity extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "Name" }),
    UUIDType({ name: "eventID", foreignKey: ["Event", "ID"] }),
    TimeType({ name: "StartTime" }),
    TimeType({ name: "EndTime", nullable: true }),
    // Name of location, not address. TODO address
    StringType({ name: "Location" }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
