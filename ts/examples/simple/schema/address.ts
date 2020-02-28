import Schema, {Field} from "./../../../schema"

/// explicit schema
export default class Address implements Schema {
  tableName: string = "addresses";

  fields: Field[] = [
    {
      name: "street_name",
      type: "string",
    },
    {
      name: "city",
      type: "string",
    },
  ]
}