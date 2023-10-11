import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import {
  AccountUpdateBalanceActionBase,
  AccountUpdateBalanceActionTriggers,
  AccountUpdateBalanceInput,
} from "src/ent/generated/account/actions/account_update_balance_action_base";

export { AccountUpdateBalanceInput };

export class AccountUpdateBalanceAction extends AccountUpdateBalanceActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
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
