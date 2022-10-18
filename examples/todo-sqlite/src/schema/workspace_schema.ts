import { UUIDType } from "@snowtop/ent";
import { ActionOperation, StringType } from "@snowtop/ent";
import { TodoBaseEntSchema } from "src/schema/patterns/base";
import { TodoContainerPattern } from "./patterns/todo_pattern";

const WorkSpaceSchema = new TodoBaseEntSchema({
  patterns: [new TodoContainerPattern()],

  fields: {
    name: StringType(),
    creatorID: UUIDType({
      foreignKey: {
        schema: "Account",
        column: "ID",
        disableIndex: true,
      },
      defaultToViewerOnCreate: true,
    }),
    // used to make the url
    slug: StringType({ unique: true }).toLowerCase().trim(),
  },

  actions: [
    {
      operation: ActionOperation.Create,
      excludedFields: ["creatorID"],
    },
    {
      operation: ActionOperation.Edit,
    },
    {
      operation: ActionOperation.Delete,
    },
  ],

  edges: [
    {
      name: "members",
      schemaName: "Account",
      inverseEdge: {
        name: "workspaces",
      },
    },
  ],
});
export default WorkSpaceSchema;
