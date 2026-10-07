import { EntSchema, ActionOperation, StringType } from "@snowtop/ent/schema";
export default new EntSchema({
  fields: { name: StringType() },
  actions: [{ operation: ActionOperation.Create, actionOnlyFields: [
    { name: "batch", type: "Object", actionName: "CreateBatchAction" },
    { name: "editRegistration", type: "Object", nullable: true, actionName: "EditRegistrationAction" },
    { name: "deleteRegistration", type: "Object", nullable: true, actionName: "DeleteRegistrationAction" },
  ] }],
});
