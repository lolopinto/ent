import { EnumType, GlobalSchema } from "@snowtop/ent/schema/";

const glo: GlobalSchema = {
  edges: [
    {
      // TODO what's the best API to edit this to add/remove edges
      // can add a new "Action" API just to get this
      // Not Action or Builder though so just something that returns Changeset(s)
      name: "loginAuth",
      schemaName: "User",
    },
  ],

  fields: {
    label: EnumType({
      values: ["work", "home", "default", "unknown", "self"],
      // TODO make these 2 required for global enum types
      tsType: "ContactLabel",
      graphQLType: "ContactLabel",
    }),
  },
};
export default glo;
