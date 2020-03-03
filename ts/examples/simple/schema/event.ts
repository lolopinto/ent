import Schema, {Field, BaseEntSchema} from "./../../../schema"
import {StringType, TimeType} from "./../../../field"

/// explicit schema
export default class Event extends BaseEntSchema implements Schema {
  fields: Field[] = [
    StringType({name: "name"}),
    StringType({name: "user_id"}),
    TimeType({name: "start_time"}),
    TimeType({name: "end_time", nullable: true}),
    StringType({name: "location"}),
  ];
}