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
      disableUserEditable: true,
      defaultToViewerOnCreate: true,
    }),
    // TODO this only exists because can't delete foreign key above
    // https://github.com/lolopinto/ent/issues/1185
    viewerCreatorID: UUIDType({
      disableUserEditable: true,
      defaultToViewerOnCreate: true,
      fieldEdge: {
        schema: "Account",
        inverseEdge: "createdWorkspaces",
      },
    }),
    // used to make the url
    slug: StringType({ unique: true }).toLowerCase().trim(),
  },

  actions: [
    {
      operation: ActionOperation.Mutations,
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
