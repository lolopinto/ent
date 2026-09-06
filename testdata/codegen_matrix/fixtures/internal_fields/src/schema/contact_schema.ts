import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { ActionOperation, EntSchema, StringType } from "@snowtop/ent/schema";

export default new EntSchema({
  defaultActionPrivacy: AlwaysAllowPrivacyPolicy,
  fields: {
    name: StringType(),
    email: StringType({ nullable: true }),
    normalized_name: StringType({ disableUserEditable: true }),
    internal_token: StringType({
      nullable: true,
      immutable: true,
      disableUserEditable: true,
      defaultValueOnCreate: () => "default-token",
    }),
    primary_email: StringType({
      nullable: true,
      disableUserEditable: true,
      defaultValueOnCreate: () => "default@example.com",
    }),
    audit_label: StringType({
      disableUserEditable: true,
      defaultValueOnCreate: () => "created",
      defaultValueOnEdit: () => "edited",
      onlyUpdateIfOtherFieldsBeingSet_BETA: true,
    }),
    server_label: StringType({
      disableUserEditable: true,
      serverDefault: "from-db",
    }),
    db_only_note: StringType({ dbOnly: true, serverDefault: "db-only" }),
  },
  edges: [{ name: "sharedAssignments", schemaName: "Assignment" }],
  actions: [
    { operation: ActionOperation.Create },
    { operation: ActionOperation.Edit },
  ],
});
