import {
  PrivacyPolicy,
  Viewer,
  Ent,
  ID,
  AlwaysAllowPrivacyPolicy,
} from "@snowtop/ent";
import { AccountTransferCreditsActionBase } from "src/ent/generated/account/actions/account_transfer_credits_action_base";
import type { AccountTransferCreditsActionTriggers, AccountTransferCreditsInput } from "src/ent/generated/account/actions/account_transfer_credits_action_base";
import { Account } from "src/ent/internal";
import { AccountUpdateBalanceAction } from "./account_update_balance_action";

export type { AccountTransferCreditsInput };

export class AccountTransferCreditsAction extends AccountTransferCreditsActionBase {
  getPrivacyPolicy(): PrivacyPolicy<
    Account,
    Viewer<Ent<any> | null, ID | null>
  > {
    return AlwaysAllowPrivacyPolicy;
  }

  getTriggers(): AccountTransferCreditsActionTriggers {
    return [
      {
        async changeset(builder, input) {
          const to = await Account.loadX(builder.viewer, input.to);
          return Promise.all([
            AccountUpdateBalanceAction.create(
              builder.viewer,
              builder.existingEnt,
              {
                credits: {
                  subtract: input.amount,
                },
              },
            ).changeset(),
            AccountUpdateBalanceAction.create(builder.viewer, to, {
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
