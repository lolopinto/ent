import { AllowIfSystemPrivacyPolicy } from "src/privacy/policies";
import { AccountUpdateBalanceActionBase } from "src/ent/generated/account/actions/account_update_balance_action_base";
import type { AccountUpdateBalanceActionTriggers, AccountUpdateBalanceInput } from "src/ent/generated/account/actions/account_update_balance_action_base";

export type { AccountUpdateBalanceInput };

export class AccountUpdateBalanceAction extends AccountUpdateBalanceActionBase {
  getPrivacyPolicy() {
    // balances only change through credit transfers. no viewer, including the
    // account itself, can set its own balance
    return AllowIfSystemPrivacyPolicy;
  }

  getTriggers(): AccountUpdateBalanceActionTriggers {
    return [
      {
        changeset(builder, input) {
          if (input.credits < 0) {
            throw new Error(`cannot have negative credits balance`);
          }
        },
      },
    ];
  }
}
