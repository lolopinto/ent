import Schema, { Field, BaseEntSchema } from "ent/schema";
import { StringType } from "ent/field";

export default class Contact extends BaseEntSchema implements Schema {
  fields: Field[] = [
    StringType({ name: "emailAddress" }),
    StringType({ name: "firstName" }),
    StringType({ name: "lastName" }),
    StringType({ name: "userID", foreignKey: ["User", "ID"] }),
  ];
}
