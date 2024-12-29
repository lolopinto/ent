import { EmailType } from "@snowtop/ent-email";
import { PhoneNumberType } from "@snowtop/ent-phonenumber";
import {
  BooleanType,
  EnumType,
  GlobalSchema,
  EnumListType,
  StructType,
  StructTypeAsList,
  UUIDType,
  StringType,
  TimestampType,
  UUIDListType,
} from "@snowtop/ent/schema/";

const glo: GlobalSchema = {
  edges: [
    {
      // TODO what's the best API to edit this to add/remove edges
      // can add a new "Action" API just to get this
      // Not Action or Builder though so just something that returns Changeset(s)
      name: "loginAuth",
      schemaName: "User",
    },
  ],

  fields: {
    label: EnumType({
      values: ["work", "home", "default", "unknown", "self"],
      // TODO make these 2 required for global enum types
      tsType: "ContactLabel",
      graphQLType: "ContactLabel",
    }),
    user_prefs: StructType({
      tsType: "UserPrefsStruct",
      fields: {
        finishedNux: BooleanType({ nullable: true }),
        enableNotifs: BooleanType({ nullable: true }),
        notifTypes: EnumListType({
          values: ["MOBILE", "WEB", "EMAIL"],
          tsType: "NotifType",
          graphQLType: "NotifType",
        }),
        homeAddressId: UUIDType({
          nullable: true,
          fieldEdge: {
            schema: "Address",
          },
        }),
        allAddressIds: UUIDListType({
          fieldEdge: {
            schema: "Address",
          },
          nullable: true,
        }),
      },
    }),
    responses: EnumType({
      values: ["yes", "no", "maybe"],
      tsType: "ResponseType",
      graphQLType: "ResponseType",
    }),
    attachments: StructTypeAsList({
      tsType: "Attachment",
      nullable: true,
      graphQLType: "Attachment",
      fields: {
        file_id: UUIDType({
          foreignKey: { schema: "File", column: "id" },
        }),
        dupeFileID: UUIDType({
          foreignKey: { schema: "File", column: "id" },
          nullable: true,
        }),
        note: StringType({ nullable: true }),
        date: TimestampType(),
        phone_number: PhoneNumberType({ nullable: true }),
        email_address: EmailType({ nullable: true }),
        creator_id: UUIDType({
          polymorphic: {
            types: ["User"],
          },
          nullable: true,
        }),
        // doesn't seem like we support this...
        // owner_ids: UUIDListType({
        //   polymorphic: {
        //     types: ["User"],
        //   },
        //   nullable: true,
        // }),
      },
    }),
  },
};
export default glo;
