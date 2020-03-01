import { DBType } from "../../../schema";

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
  ]
};

export default User;
