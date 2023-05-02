import {
  BooleanType,
  EnumType,
  GlobalSchema,
  EnumListType,
  StructType,
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
      },
    }),
    responses: EnumType({
      values: ["yes", "no", "maybe"],
      tsType: "ResponseType",
      graphQLType: "ResponseType",
    }),
  },
};
export default glo;
