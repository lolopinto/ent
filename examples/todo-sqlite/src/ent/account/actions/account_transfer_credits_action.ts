import { PrivacyPolicy, Viewer, Ent, ID } from "@snowtop/ent";
import { AccountTransferCreditsActionBase } from "src/ent/generated/account/actions/account_transfer_credits_action_base";
import type { AccountTransferCreditsActionTriggers, AccountTransferCreditsActionValidators, AccountTransferCreditsInput } from "src/ent/generated/account/actions/account_transfer_credits_action_base";
import { Account } from "src/ent/internal";
import {
  AllowIfAccountOrSystemPrivacyPolicy,
  SystemViewer,
} from "src/privacy/policies";
import { AccountUpdateBalanceAction } from "./account_update_balance_action";

export type { AccountTransferCreditsInput };

export class AccountTransferCreditsAction extends AccountTransferCreditsActionBase {
  getPrivacyPolicy(): PrivacyPolicy<
    Account,
    Viewer<Ent<any> | null, ID | null>
  > {
    // only the source account, or a bounty payout from ChangeTodoStatusAction
    return AllowIfAccountOrSystemPrivacyPolicy;
  }

  getValidators(): AccountTransferCreditsActionValidators {
    return [
      {
        validate(builder, input) {
          if (!Number.isInteger(input.amount) || input.amount <= 0) {
            throw new Error(`transfer amount must be a positive integer`);
          }
        },
      },
    ];
  }

  getTriggers(): AccountTransferCreditsActionTriggers {
    return [
      {
        async changeset(builder, input) {
          // balance updates are only allowed on behalf of an authorized transfer
          const viewer = new SystemViewer();
          const to = await Account.loadX(viewer, input.to);
          return Promise.all([
            AccountUpdateBalanceAction.create(viewer, builder.existingEnt, {
              credits: {
                subtract: input.amount,
              },
            }).changeset(),
            AccountUpdateBalanceAction.create(viewer, to, {
              credits: {
                add: input.amount,
              },
            }).changeset(),
          ]);
        },
      },
    ];
  }
}
