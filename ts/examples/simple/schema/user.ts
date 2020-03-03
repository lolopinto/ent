import { DBType, Node } from "../../../schema";

// implicit schema
const User = {
  tableName: "users",
  fields: [
    {
      name: "FirstName",
      type: {
        dbType: DBType.String,
      },
    },
    {
      name: "LastName",
      type: {
        dbType: DBType.String,
      },
    },
  ],
  patterns: [Node],
};

export default User;
