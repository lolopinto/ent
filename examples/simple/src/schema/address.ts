import {
  DBType,
  Node,
  StringType,
  ActionOperation,
  optionalField,
} from "@snowtop/ent/schema/";

// implicit schema
const Address = {
  tableName: "addresses",
  fields: [
    {
      name: "street_name",
      type: {
        dbType: DBType.String,
      },
      logValue: (val: any) => val,
    },
    {
      name: "city",
      type: {
        dbType: DBType.String,
      },
      logValue: (val: any) => val,
    },
    StringType({ name: "state" }),
    StringType({ name: "zip" }),
    StringType({ name: "apartment", nullable: true }),
    StringType({ name: "country", serverDefault: "US" }),
  ],
  patterns: [Node],

  actions: [
    {
      operation: ActionOperation.Create,
      fields: [
        "street_name",
        "city",
        "state",
        "zip",
        "apartment",
        // country is optional here but required in schema
        // which means we need default value (or to add it as a trigger)
        optionalField("country"),
      ],
    },
  ],
};

export default Address;
