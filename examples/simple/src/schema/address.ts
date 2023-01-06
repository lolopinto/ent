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
  fields: {
    street_name: {
      type: {
        dbType: DBType.String,
      },
      logValue: (val: any) => val,
    },
    city: {
      type: {
        dbType: DBType.String,
      },
      logValue: (val: any) => val,
    },
    state: StringType(),
    zip: StringType(),
    apartment: StringType({ nullable: true }),
    country: StringType({ serverDefault: "US" }),
  },
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
