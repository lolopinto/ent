import type { AddPaymentWatcherInput } from "./ent/generated/payment/actions/add_payment_watcher_action_base";
import {
  PaymentPaymentReviewStatusInput,
  type SetPaymentReviewStatusInput,
} from "./ent/generated/payment/actions/set_payment_review_status_action_base";

const addPaymentWatcherInput: AddPaymentWatcherInput = {
  reason: "watching for review",
};

const setPaymentReviewStatusInput: SetPaymentReviewStatusInput = {
  paymentReviewStatus: PaymentPaymentReviewStatusInput.Reviewed,
  userId: "viewer",
  note: "reviewed",
};

void addPaymentWatcherInput;
void setPaymentReviewStatusInput;
