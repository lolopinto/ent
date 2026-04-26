import {
  ActionOperation,
  ConstraintType,
  EntSchema,
  IntegerType,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema";

const AccountSchema = new EntSchema({
  tableName: "matrix_core_accounts",
  fields: {
    ownerID: UUIDType({
      index: true,
      foreignKey: {
        schema: "User",
        column: "id",
        ondelete: "CASCADE",
      },
    }),
    accountNumber: StringType({
      unique: true,
      storageKey: "account_number",
    }),
    balance: IntegerType({
      serverDefault: "0",
    }),
    memo: StringType({
      nullable: true,
    }),
  },
  constraints: [
    {
      name: "matrix_core_accounts_owner_number_unique",
      type: ConstraintType.Unique,
      columns: ["ownerID", "accountNumber"],
    },
    {
      name: "matrix_core_accounts_balance_non_negative",
      type: ConstraintType.Check,
      columns: [],
      condition: "balance >= 0",
    },
  ],
  indices: [
    {
      name: "matrix_core_accounts_owner_positive_balance_idx",
      columns: ["ownerID", "balance"],
      where: "balance > 0",
    },
  ],
  actions: [
    {
      operation: ActionOperation.Create,
      fields: ["ownerID", "accountNumber", "balance", "memo"],
    },
    {
      operation: ActionOperation.Edit,
      fields: ["balance", "memo"],
    },
    {
      operation: ActionOperation.Delete,
    },
  ],
});

export default AccountSchema;
