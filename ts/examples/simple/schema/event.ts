import Schema, {Field} from "./../../../schema"

/// explicit schema
export default class Event implements Schema {
  fields: Field[] = [
    {
      name: "name",
      type: "string",
    },
    {
      name: "user_id",
      type: "string",
    },
    {
      name: "start_time",
      type: "time", // todo
    },
    {
      name: "end_time",
      type: "time",
      nullable: true,
    },
    {
      name: "location",
      type: "string",
    },
  ]
}