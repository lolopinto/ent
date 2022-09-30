import { EnumType } from "@snowtop/ent";
import { AllowIfViewerPrivacyPolicy } from "@snowtop/ent";
import { ActionOperation, StringType } from "@snowtop/ent";
import { PhoneNumberType } from "@snowtop/ent-phonenumber";
import { DeletedAtPattern } from "@snowtop/ent-soft-delete";
import { TodoEntSchema } from "src/schema/patterns/base";

const AccountSchema = new TodoEntSchema({
  patterns: [new DeletedAtPattern()],

  fields: {
    Name: StringType(),
    PhoneNumber: PhoneNumberType({
      unique: true,
      // only viewer can see their phone number
      privacyPolicy: AllowIfViewerPrivacyPolicy,
    }),
    accountState: EnumType({
      nullable: true,
      tsType: "AccountState",
      graphQLType: "AccountState",
      values: ["UNVERIFIED", "VERIFIED", "DEACTIVATED", "DISABLED"],
      defaultValueOnCreate: () => "UNVERIFIED",
      // only viewer can see their account state
      privacyPolicy: AllowIfViewerPrivacyPolicy,
      hideFromGraphQL: true,
      // if hidden from graphql and an enum, this also needs to be set
      // we should have an error for this...
      disableUserGraphQLEditable: true,
    }),
  },

  actions: [
    {
      operation: ActionOperation.Mutations,
    },
  ],

  // duplicating account to todo information in edges so we can test
  // edge groups with no null states since the only state of a Todo is open/closed
  edgeGroups: [
    {
      tableName: "todo_edges",
      assocEdges: [
        {
          name: "openTodosDup",
          schemaName: "Todo",
        },
        {
          name: "closedTodosDup",
          schemaName: "Todo",
        },
      ],
      name: "todos",
      groupStatusName: "todoStatus",
      edgeAction: {
        operation: ActionOperation.EdgeGroup,
      },
    },
  ],
});
export default AccountSchema;
