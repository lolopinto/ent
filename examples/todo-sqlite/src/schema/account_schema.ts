import {
  BooleanType,
  ConstraintType,
  EnumType,
  IntegerType,
  StructType,
  StructTypeAsList,
} from "@snowtop/ent";
import { AllowIfViewerPrivacyPolicy } from "@snowtop/ent";
import { ActionOperation, StringType } from "@snowtop/ent";
import { PhoneNumberType } from "@snowtop/ent-phonenumber";
import { TodoBaseEntSchema } from "src/schema/patterns/base";
import { TodoContainerPattern } from "./patterns/todo_pattern";

const AccountSchema = new TodoBaseEntSchema({
  patterns: [new TodoContainerPattern()],

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
      // TODO we should have an error for this...
      // can check import types and see if it makes sense?
      // if referencing a local import?
      disableUserGraphQLEditable: true,
    }),
    accountPrefs: StructType({
      nullable: true,
      tsType: "AccountPrefs",
      graphQLType: "AccountPrefs",
      fields: {
        finishedNux: BooleanType(),
        enableNotifs: BooleanType(),
        preferredLanguage: StringType(),
      },
    }),
    accountPrefsList: StructTypeAsList({
      nullable: true,
      tsType: "AccountPrefs2",
      graphQLType: "AccountPrefs2",
      fields: {
        finishedNux: BooleanType(),
        enableNotifs: BooleanType(),
        preferredLanguage: StringType(),
      },
    }),
    // new credits. everyone starts with 1000
    // only way to currently increase this value is to do a Todo
    // with a bounty
    credits: IntegerType({
      serverDefault: 1000,
      // only viewer can see their credits balance
      privacyPolicy: AllowIfViewerPrivacyPolicy,
    }),
  },

  actions: [
    {
      operation: ActionOperation.Create,
    },
    {
      operation: ActionOperation.Edit,
      excludedFields: ["credits"],
    },
    {
      operation: ActionOperation.Edit,
      actionName: "AccountUpdateBalanceAction",
      inputName: "AccountUpdateBalanceInput",
      graphQLName: "accountUpdateBalance",
      fields: ["credits"],
      requiredFields: ["credits"],
    },
    {
      // it transfers from this account to given account
      operation: ActionOperation.Edit,
      actionName: "AccountTransferCreditsAction",
      inputName: "AccountTransferCreditsInput",
      graphQLName: "accountTransferCredits",
      noFields: true,
      actionOnlyFields: [
        {
          name: "to",
          type: "ID",
        },
        {
          name: "amount",
          type: "Int",
        },
      ],
    },
    {
      operation: ActionOperation.Delete,
    },
  ],

  // TODO fix this with SQLite
  // TODO addCheckConstraint check here doesn't always work? it's confusing...
  // constraints: [
  //   {
  //     type: ConstraintType.Check,
  //     columns: [],
  //     name: "non_negative_credits_balance",
  //     condition: "credits >=0",
  //   },
  // ],

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
