import {
  AlwaysAllowPrivacyPolicy,
  AlwaysDenyPrivacyPolicy,
} from "@snowtop/ent";
import {
  ActionOperation,
  EntSchema,
  StringType,
  UUIDType,
  UUIDListType,
} from "@snowtop/ent/schema";

export default new EntSchema({
  defaultActionPrivacy: AlwaysAllowPrivacyPolicy,
  fields: {
    name: StringType(),
    shared_owner_id: UUIDType({
      nullable: true,
      disableUserEditable: true,
      fieldEdge: { schema: "Contact", inverseEdge: "sharedAssignments" },
    }),
    shared_second_id: UUIDType({
      nullable: true,
      disableUserEditable: true,
      fieldEdge: { schema: "Contact", inverseEdge: "sharedAssignments" },
    }),
    derived_owner_id: UUIDType({
      nullable: true,
      disableUserEditable: true,
      fieldEdge: {
        schema: "Contact",
        inverseEdge: { name: "derivedAssignments" },
      },
    }),
    default_owner_id: UUIDType({
      nullable: true,
      disableUserEditable: true,
      privacyPolicy: AlwaysDenyPrivacyPolicy,
      defaultToViewerOnCreate: true,
      defaultValueOnEdit: (builder) => builder.viewer.viewerID,
      fieldEdge: {
        schema: "Contact",
        inverseEdge: { name: "defaultAssignments" },
      },
    }),
    private_owner_id: UUIDType({
      nullable: true,
      disableUserEditable: true,
      privacyPolicy: AlwaysDenyPrivacyPolicy,
      fieldEdge: {
        schema: "Contact",
        inverseEdge: { name: "privateAssignments" },
      },
    }),
    member_ids: UUIDListType({
      nullable: true,
      disableUserEditable: true,
      fieldEdge: {
        schema: "Contact",
        inverseEdge: { name: "memberAssignments" },
      },
    }),
    editable_owner_id: UUIDType({
      nullable: true,
      fieldEdge: {
        schema: "Contact",
        inverseEdge: { name: "editableAssignments" },
      },
    }),
  },
  actions: [
    { operation: ActionOperation.Create },
    { operation: ActionOperation.Edit },
    { operation: ActionOperation.Delete },
  ],
});
