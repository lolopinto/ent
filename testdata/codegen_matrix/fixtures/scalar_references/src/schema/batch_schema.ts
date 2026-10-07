import { EntSchema, ActionOperation, StringType } from "@snowtop/ent/schema";
export default new EntSchema({
  fields: { name: StringType() },
  actions: [{ operation: ActionOperation.Create, actionOnlyFields: [
    { name: "createdRegistration", type: "Object", nullable: true, actionName: "CreateRegistrationAction" },
    { name: "changedRegistration", type: "Object", nullable: true, actionName: "EditRegistrationAction" },
    { name: "removedRegistration", type: "Object", nullable: true, actionName: "DeleteRegistrationAction" },
    { name: "registrations", type: "Object", list: true, nullable: "contents", actionName: "CreateRegistrationAction" },
    { name: "optionalRegistrations", type: "Object", list: true, nullable: "contentsAndList", actionName: "CreateRegistrationAction" },
  ] }],
});
