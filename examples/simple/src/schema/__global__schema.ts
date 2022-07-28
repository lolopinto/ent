import { GlobalSchema } from "@snowtop/ent/schema/";

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
};
export default glo;
