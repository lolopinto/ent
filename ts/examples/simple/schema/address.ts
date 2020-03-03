import Schema, {Field, BaseEntSchema} from "./../../../schema"
import {StringType} from "./../../../field"

/// explicit schema
export default class Address extends BaseEntSchema implements Schema {
  tableName: string = "addresses";

  fields: Field[] = [
    StringType({name: "street_name", maxLen: 100}),
    StringType({name: "city"}),
    StringType({name: "zip"}).match(/^\d{5}(-\d{4})?$/),
  ];
}