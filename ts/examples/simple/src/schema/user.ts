import { DBType, Node } from "ent/schema";

// TODO this is too complicated to be implicit.
// create a simpler one that's implicit
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
  edges: [
    {
      name: "createdEvents",
      schemaName: "Event",
    },
    {
      name: "friends",
      schemaName: "User",
      symmetric: true,
    },
  ],
};

export default User;
