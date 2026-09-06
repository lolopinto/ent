import { ActionOperation, EntSchema, StringType } from "@snowtop/ent/schema";
import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";

export default new EntSchema({
  fields: { name: StringType() },
  defaultActionPrivacy: AlwaysAllowPrivacyPolicy,
  actions: [{ operation: ActionOperation.Mutations }],
  edges: [
    { name: "documents", schemaName: "Document" },
    { name: "internalDocuments", schemaName: "Document" },
  ],
});
