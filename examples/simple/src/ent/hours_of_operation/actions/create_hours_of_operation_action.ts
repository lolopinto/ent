import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import {
  CreateHoursOfOperationActionBase,
  HoursOfOperationCreateInput,
} from "./generated/create_hours_of_operation_action_base";

export { HoursOfOperationCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateHoursOfOperationAction extends CreateHoursOfOperationActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
