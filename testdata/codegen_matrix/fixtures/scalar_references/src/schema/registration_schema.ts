import { EntSchema, ActionOperation, UUIDType, UUIDListType } from "@snowtop/ent/schema";
export default new EntSchema({
  fields: { registryId: UUIDType(), registryIds: UUIDListType(), rawId: UUIDType({disableBase64Encode: true}) },
  actions: [
    { operation: ActionOperation.Create, optionalFields: ["registryId", "registryIds", "rawId"] },
    { operation: ActionOperation.Edit, optionalFields: ["registryId", "registryIds", "rawId"] },
    { operation: ActionOperation.Delete },
  ],
});
