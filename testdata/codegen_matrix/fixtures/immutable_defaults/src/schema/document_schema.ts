import {
  ActionOperation,
  EntSchema,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema";
import { AllowIfViewerIsEntPropertyRule, AlwaysDenyRule } from "@snowtop/ent";
import type { Document } from "../ent";

export default new EntSchema({
  fields: {
    title: StringType(),
    ownerId: UUIDType({
      immutable: true,
      defaultToViewerOnCreate: true,
      fieldEdge: { schema: "User", inverseEdge: "documents" },
    }),
    internalOwnerId: UUIDType({
      disableUserEditable: true,
      defaultToViewerOnCreate: true,
      fieldEdge: { schema: "User", inverseEdge: "internalDocuments" },
    }),
    syncValue: StringType({
      immutable: true,
      defaultValueOnCreate: () => " SYNC ",
    })
      .trim()
      .toLowerCase()
      .minLen(1),
    asyncValue: StringType({
      immutable: true,
      defaultValueOnCreate: async () => " ASYNC ",
    })
      .trim()
      .toLowerCase()
      .minLen(1),
  },
  defaultActionPrivacy: {
    rules: [
      new AllowIfViewerIsEntPropertyRule<Document>("ownerId"),
      AlwaysDenyRule,
    ],
  },
  actions: [{ operation: ActionOperation.Mutations }],
});
