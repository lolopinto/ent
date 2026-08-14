import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { CreateHolidayActionBase } from "../../generated/holiday/actions/create_holiday_action_base.js";
import type { HolidayCreateInput } from "../../generated/holiday/actions/create_holiday_action_base.js";
export type { HolidayCreateInput };
// we're only writing this once except with --force and packageName provided
export default class CreateHolidayAction extends CreateHolidayActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
