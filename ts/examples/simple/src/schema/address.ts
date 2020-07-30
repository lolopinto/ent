import { DBType, Node, StringType } from "@lolopinto/ent/schema/";

// implicit schema
const Address = {
  tableName: "addresses",
  fields: [
    {
      name: "street_name",
      type: {
        dbType: DBType.String,
      },
    },
    {
      name: "city",
      type: {
        dbType: DBType.String,
      },
    },
    StringType({ name: "zip" }).match(/^\d{5}(-\d{4})?$/),
  ],
  patterns: [Node],
};

export default Address;
