import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import {
  CreateHolidayActionBase,
  HolidayCreateInput,
} from "./generated/create_holiday_action_base";

export { HolidayCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateHolidayAction extends CreateHolidayActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
