import {
  ActionOperation,
  EntSchema,
  IntegerType,
  UUIDType,
} from "@snowtop/ent/schema";

const RegistrationSchema = new EntSchema({
  fields: {
    registryID: UUIDType(),
    position: IntegerType(),
  },
  actions: [
    {
      operation: ActionOperation.Create,
      actionName: "AddRegistrationAction",
    },
  ],
});

export default RegistrationSchema;
