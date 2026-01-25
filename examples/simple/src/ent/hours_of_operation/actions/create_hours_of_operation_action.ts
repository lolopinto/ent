import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { CreateHoursOfOperationActionBase } from "../../generated/hours_of_operation/actions/create_hours_of_operation_action_base";
import type { HoursOfOperationCreateInput } from "../../generated/hours_of_operation/actions/create_hours_of_operation_action_base";
export type { HoursOfOperationCreateInput };
// we're only writing this once except with --force and packageName provided
export default class CreateHoursOfOperationAction extends CreateHoursOfOperationActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
